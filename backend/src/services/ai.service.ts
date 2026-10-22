import fs from 'fs/promises';

export interface AiPrediction {
  prediction: 'malignant' | 'non_malignant';
  confidence_score: number; // 0-100
  probabilities: {
    non_malignant: number; // 0-100
    malignant: number; // 0-100
  };
  xai: {
    method: string;
    target_class: string;
    target_layer: string;
    roi_bbox: { x: number; y: number; width: number; height: number };
    heatmap_mime_type: string;
    heatmap_base64: string;
  };
}

export class AiServiceError extends Error {}

// Python FastAPI servisine (ai_model/app.py) görüntüyü gönderir
export const requestPrediction = async (
  filePath: string,
  mimeType: string,
  originalName: string
): Promise<AiPrediction> => {
  const baseUrl = process.env.AI_SERVICE_URL || 'http://localhost:8000';
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 120_000;

  const buffer = await fs.readFile(filePath);
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(buffer)], { type: mimeType }), originalName);

  let response: Response;
  try {
    response = await fetch(`${baseUrl}/predict`, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new AiServiceError(`AI servisine ulaşılamadı (${baseUrl}): ${reason}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new AiServiceError(`AI servisi hata döndürdü (${response.status}): ${body}`);
  }

  return (await response.json()) as AiPrediction;
};
