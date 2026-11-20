@echo off
chcp 65001 >nul
echo ========================================================
echo  MammoXAI - Docker ile Tum Servisleri Baslatma (Windows)
echo ========================================================
echo.

if not exist .env (
    echo [UYARI] .env dosyasi bulunamadi!
    if exist .env.example (
        echo .env.example dosyasi .env olarak kopyalaniyor...
        copy .env.example .env
        echo Lutfen .env dosyasindaki baglanti ayarlarini kontrol edin.
    ) else (
        echo Lutfen bir .env dosyasi olusturun.
        pause
        exit /b 1
    )
)

echo Docker Compose servisleri derleniyor ve baslatiliyor...
echo Servisler:
echo  - Frontend (React):   http://localhost:5173
echo  - Backend API:        http://localhost:5001
echo  - AI Model (PyTorch): http://localhost:8000
echo.

docker compose up --build

pause

