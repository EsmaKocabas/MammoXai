import os
import io
import base64
import threading
import cv2
import numpy as np
import torch
import torch.nn as nn
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.concurrency import run_in_threadpool
from torchvision import models, transforms
from PIL import Image

app = FastAPI(title="MammoXAI Model API", version="1.1.0")

# 1. Cihaz Belirleme
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

# 2. Auto-ROI & CLAHE Enhancer (Eğitim kodunuzdaki ön işleme sınıfı)
class MedicalROIEnhancer:
    def process(self, img):
        """Kırpılmış + CLAHE uygulanmış görüntüyü ve orijinal görüntüdeki ROI kutusunu döndürür."""
        img_np = np.array(img)
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY) if len(img_np.shape) == 3 else img_np
        H, W = gray.shape[:2]
        bbox = (0, 0, W, H)  # (x, y, w, h) - kırpma olmazsa tüm görüntü

        _, thresh = cv2.threshold(gray, 12, 255, cv2.THRESH_BINARY)
        contours, _ = cv2.findContours(thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

        if contours:
            c = max(contours, key=cv2.contourArea)
            x, y, w, h = cv2.boundingRect(c)
            if w > 40 and h > 40:
                gray = gray[y:y+h, x:x+w]
                bbox = (x, y, w, h)

        clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
        enhanced = clahe.apply(gray)
        return transforms.functional.to_pil_image(cv2.cvtColor(enhanced, cv2.COLOR_GRAY2RGB)), bbox

    def __call__(self, img):
        # transforms.Compose içinde kullanım için (eğitim koduyla uyumlu)
        return self.process(img)[0]

# 3. Model Mimarisini Tanımlama (EfficientNet-B4, 2 Sınıf)
model = models.efficientnet_b4(weights=None)
num_ftrs = model.classifier[1].in_features
model.classifier = nn.Sequential(
    nn.Dropout(0.4),
    nn.Linear(num_ftrs, 2)
)

# 4. Kaydedilmiş En İyi Ağırlıkları Yükleme
MODEL_DIR = os.path.dirname(os.path.abspath(__file__))
WEIGHTS_PATH = os.path.join(MODEL_DIR, "efficientnet_b4_binary_final_best.pth")
MODEL_READY = False

if os.path.exists(WEIGHTS_PATH):
    print(f"[MammoXAI] Model ağırlıkları yükleniyor: {WEIGHTS_PATH}")
    model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=device))
    model.to(device)
    model.eval()  # Çıkarım (inference) modu
    # Ağırlıklar için gradyan gerekmez; Grad-CAM++ yalnızca aktivasyon gradyanlarını kullanır
    for p in model.parameters():
        p.requires_grad_(False)
    MODEL_READY = True
    print("[MammoXAI] Model başarıyla yüklendi ve hazır.")
else:
    print(f"[MammoXAI UYARI] Ağırlık dosyası bulunamadı: {WEIGHTS_PATH}")

# 5. Ön İşlem ve Test Transformları
# val_transforms = [MedicalROIEnhancer, Resize, ToTensor, Normalize] ile birebir aynı;
# ROI kutusuna ihtiyaç duyduğumuz için enhancer ayrı çağrılıyor.
roi_enhancer = MedicalROIEnhancer()
tensor_transforms = transforms.Compose([
    transforms.Resize((384, 384)),
    transforms.ToTensor(),
    transforms.Normalize(mean=[0.485, 0.456, 0.406], std=[0.229, 0.224, 0.225])
])

class_names = ['non_malignant', 'malignant']


# 6. Grad-CAM++ (Chattopadhyay et al., 2018)
class GradCAMPlusPlus:
    def __init__(self, model: nn.Module, target_layer: nn.Module):
        self.model = model
        self.activations = None
        self.gradients = None
        target_layer.register_forward_hook(self._forward_hook)

    def _forward_hook(self, module, inputs, output):
        self.activations = output
        if output.requires_grad:
            output.register_hook(self._save_gradient)

    def _save_gradient(self, grad):
        self.gradients = grad

    def __call__(self, input_tensor: torch.Tensor, target_class: int | None = None):
        input_tensor = input_tensor.clone().requires_grad_(True)
        logits = self.model(input_tensor)
        probs = torch.softmax(logits, dim=1)[0].detach()

        if target_class is None:
            target_class = int(probs.argmax().item())

        logits[0, target_class].backward()

        grads = self.gradients[0]                 # (K, h, w)
        acts = self.activations[0].detach()       # (K, h, w)

        grads_2 = grads.pow(2)
        grads_3 = grads_2 * grads
        sum_acts = acts.sum(dim=(1, 2), keepdim=True)

        denom = 2 * grads_2 + sum_acts * grads_3
        denom = torch.where(denom != 0, denom, torch.ones_like(denom))
        alpha = grads_2 / denom

        weights = (alpha * torch.relu(grads)).sum(dim=(1, 2))          # (K,)
        cam = torch.relu((weights[:, None, None] * acts).sum(dim=0))   # (h, w)

        cam = cam - cam.min()
        if cam.max() > 0:
            cam = cam / cam.max()

        self.activations, self.gradients = None, None
        return probs.cpu(), target_class, cam.cpu().numpy().astype(np.float32)


# EfficientNet-B4'ün son evrişim bloğu (1792 kanal, 384px girişte 12x12)
grad_cam = GradCAMPlusPlus(model, model.features[-1])
# Hook'lar paylaşımlı durum tuttuğu için eşzamanlı istekleri sıraya alıyoruz
inference_lock = threading.Lock()

HEATMAP_ALPHA = 0.4
MAX_OUTPUT_SIDE = 2048


def build_heatmap_overlay(original_rgb: np.ndarray, cam: np.ndarray, bbox: tuple) -> np.ndarray:
    """Isı haritasını ROI kutusuna geri yerleştirip orijinal görüntünün üzerine bindirir (BGR döner)."""
    x, y, w, h = bbox
    cam_roi = cv2.resize(cam, (w, h), interpolation=cv2.INTER_LINEAR)
    heat_roi = cv2.applyColorMap(np.uint8(255 * cam_roi), cv2.COLORMAP_JET)

    overlay = cv2.cvtColor(original_rgb, cv2.COLOR_RGB2BGR)
    roi = overlay[y:y+h, x:x+w]
    overlay[y:y+h, x:x+w] = cv2.addWeighted(roi, 1 - HEATMAP_ALPHA, heat_roi, HEATMAP_ALPHA, 0)

    longest = max(overlay.shape[:2])
    if longest > MAX_OUTPUT_SIDE:
        scale = MAX_OUTPUT_SIDE / longest
        overlay = cv2.resize(overlay, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    return overlay


def run_analysis(image: Image.Image) -> dict:
    enhanced, bbox = roi_enhancer.process(image)
    input_tensor = tensor_transforms(enhanced).unsqueeze(0).to(device)

    with inference_lock:
        probs, target_class, cam = grad_cam(input_tensor)

    confidence = probs[target_class].item()
    overlay = build_heatmap_overlay(np.array(image), cam, bbox)
    ok, buffer = cv2.imencode(".jpg", overlay, [cv2.IMWRITE_JPEG_QUALITY, 90])
    if not ok:
        raise RuntimeError("Isı haritası kodlanamadı.")

    x, y, w, h = bbox
    return {
        "prediction": class_names[target_class],
        "confidence_score": round(confidence * 100, 2),
        "probabilities": {
            "non_malignant": round(probs[0].item() * 100, 2),
            "malignant": round(probs[1].item() * 100, 2)
        },
        "xai": {
            "method": "Grad-CAM++",
            "target_class": class_names[target_class],
            "target_layer": "features[-1]",
            "roi_bbox": {"x": x, "y": y, "width": w, "height": h},
            "heatmap_mime_type": "image/jpeg",
            "heatmap_base64": base64.b64encode(buffer.tobytes()).decode("ascii")
        }
    }


@app.get("/")
def read_root():
    return {
        "service": "MammoXAI AI Model Service",
        "status": "ready" if MODEL_READY else "weights_missing",
        "device": str(device)
    }

@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    if not MODEL_READY:
        raise HTTPException(status_code=503, detail="Model ağırlıkları yüklenmedi.")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Lütfen geçerli bir resim dosyası yükleyin.")

    try:
        # Görüntüyü oku
        image_bytes = await file.read()
        image = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except Exception:
        raise HTTPException(status_code=400, detail="Görüntü dosyası okunamadı.")

    try:
        # Ağır hesaplama event loop'u bloklamasın diye thread pool'da çalıştırılır
        return await run_in_threadpool(run_analysis, image)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Tahmin sırasında hata oluştu: {str(e)}")
