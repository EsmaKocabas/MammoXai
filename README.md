# MammoXAI - Klinik Karar Destek Sistemi (XAI Destekli Mamografi Analizi)

MammoXAI, derin öğrenme (EfficientNet-B4) ve Açıklanabilir Yapay Zeka (Grad-CAM++) tekniklerini kullanarak mamografi görüntülerinden meme kanseri riskini analiz eden tam kapsamlı bir klinik karar destek platformudur.

---

## 🚀 Hızlı Başlangıç (Docker ile Tek Komutla Çalıştırma)

Hem **Windows** hem de **Mac** (Intel & Apple Silicon M1/M2/M3/M4) bilgisayarlarda projeyi tüm servisleriyle (Frontend, Backend, AI Model) tek komutla çalıştırmak için Docker Compose kullanılır.

### 1. Ön Koşullar
- Bilgisayarınızda **Docker Desktop** kurulu ve çalışıyor olmalıdır.
  - Windows: [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/)
  - Mac: [Docker Desktop for Mac (Apple Silicon / Intel)](https://docs.docker.com/desktop/setup/install/mac-install/)

### 2. Ortam Değişkenleri (.env)
Proje kök dizininde bir `.env` dosyası olduğundan emin olun. Yoksa `.env.example` dosyasından kopyalayabilirsiniz:
```bash
# Mac / Linux:
cp .env.example .env

# Windows (PowerShell):
copy .env.example .env
```
> **Not:** Veritabanı NeonDB üzerinde bulutta barındırıldığı için yerel PostgreSQL kurulumuna ihtiyaç yoktur, `.env` dosyasındaki `DATABASE_URL` bağlantısı yeterlidir.

### 3. Model Ağırlık Dosyası
`backend/ai_model/efficientnet_b4_binary_final_best.pth` dosyasının mevcut olduğunu doğrulayın (71 MB boyutunda eğitilmiş model ağırlıkları).

### 4. Tek Komutla Başlatma

#### Windows için:
`docker-start.bat` dosyasına çift tıklayabilir veya terminalden çalıştırabilirsiniz:
```powershell
docker compose up --build
```

#### Mac için:
Terminali açın, proje klasörüne gidin ve çalıştırın:
```bash
chmod +x docker-start.sh
./docker-start.sh
```
veya doğrudan:
```bash
docker compose up --build
```

---

## 🌐 Çalışan Servisler ve Portlar

| Servis | Adres | Açıklama |
|---|---|---|
| **Frontend** | [http://localhost:5173](http://localhost:5173) | React + Vite tabanlı hekim arayüzü |
| **Backend API** | [http://localhost:5001](http://localhost:5001) | Node.js Express REST API ve SSE push servisi |
| **AI Model Servisi** | [http://localhost:8000](http://localhost:8000) | Python FastAPI + PyTorch EfficientNet-B4 & Grad-CAM++ |

---

## 🛠️ Docker Komutları Rehberi

```bash
# Tüm servisleri arka planda (detached) başlatmak için:
docker compose up -d

# Logları canlı takip etmek için:
docker compose logs -f

# Sadece belirli bir servisin logunu görmek için:
docker compose logs -f ai-model
docker compose logs -f backend
docker compose logs -f frontend

# Tüm servisleri durdurmak için:
docker compose down

# Veri disklerini (yüklenen resimler) de temizleyerek tamamen sıfırlamak için:
docker compose down -v
```

---

## 💻 Alternatif: Docker Olmadan Geliştirme (Lokal Çalıştırma)

Eğer Docker kullanmadan terminal üzerinden ayrı ayrı çalıştırmak isterseniz:

1. **AI Model (Terminal 1):**
   ```bash
   cd backend/ai_model
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # Mac:
   source venv/bin/activate
   pip install -r requirements.txt
   uvicorn app:app --port 8000
   ```

2. **Backend (Terminal 2):**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

3. **Frontend (Terminal 3):**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
