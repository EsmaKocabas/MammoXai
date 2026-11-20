#!/usr/bin/env bash
# ========================================================
#  MammoXAI - Docker ile Tüm Servisleri Başlatma (Mac / Linux)
# ========================================================

set -e

cd "$(dirname "$0")"

echo "========================================================"
echo " MammoXAI - Docker Servisleri Başlatılıyor (Mac / Linux)"
echo "========================================================"
echo ""

if [ ! -f .env ]; then
    echo "⚠️  .env dosyası bulunamadı!"
    if [ -f .env.example ]; then
        echo "📄 .env.example dosyası .env olarak kopyalanıyor..."
        cp .env.example .env
        echo "Lütfen .env dosyasındaki bağlantı ayarlarını kontrol edin."
    else
        echo "❌ Lütfen bir .env dosyası oluşturun."
        exit 1
    fi
fi

# Model ağırlık kontrolü
if [ ! -f backend/ai_model/efficientnet_b4_binary_final_best.pth ]; then
    echo "⚠️  UYARI: backend/ai_model/efficientnet_b4_binary_final_best.pth bulunamadı!"
    echo "AI modelinin çalışabilmesi için eğitilmiş .pth ağırlık dosyasını bu klasöre eklemelisiniz."
    echo ""
fi

echo "🚀 Servisler başlatılıyor..."
echo "  - Frontend (React):   http://localhost:5173"
echo "  - Backend API:        http://localhost:5001"
echo "  - AI Model (PyTorch): http://localhost:8000"
echo ""

docker compose up --build

