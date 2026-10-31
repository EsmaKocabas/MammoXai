-- ============================================================
-- MammoXai - PostgreSQL Veritabanı Şeması (NeonDB)
-- ============================================================
-- Çalıştırma: psql bağlantısıyla ya da NeonDB SQL editörüyle
-- ============================================================

-- UUID desteğini etkinleştir
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. DOKTORLAR (doctors)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctors (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    tc_no           VARCHAR(11) UNIQUE,
    email           VARCHAR(255) NOT NULL UNIQUE,
    password_hash   TEXT        NOT NULL,
    full_name       VARCHAR(150) NOT NULL,
    title           VARCHAR(80),
    specialty       VARCHAR(120),
    hospital        VARCHAR(200),
    phone           VARCHAR(20),
    profile_photo_url TEXT,
    is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
    is_verified     BOOLEAN     NOT NULL DEFAULT FALSE,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. ŞİFRE SIFIRLAMA TOKENLERİ (password_reset_tokens)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    token       TEXT        NOT NULL UNIQUE,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. HASTALAR (patients)
-- ============================================================
CREATE TABLE IF NOT EXISTS patients (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Kimlik Bilgileri
    tc_no           CHAR(11)    NOT NULL UNIQUE,
    first_name      VARCHAR(80) NOT NULL,
    last_name       VARCHAR(80) NOT NULL,
    date_of_birth   DATE        NOT NULL,
    gender          VARCHAR(10) NOT NULL CHECK (gender IN ('Kadın', 'Erkek', 'Diğer')),

    -- İletişim
    phone           VARCHAR(20),
    email           VARCHAR(255),
    address         TEXT,

    -- Klinik Bilgiler
    blood_type      VARCHAR(5),
    allergies       TEXT,
    chronic_diseases TEXT,
    family_history_of_cancer BOOLEAN DEFAULT FALSE,

    -- Kayıt Bilgileri
    registered_by   UUID        NOT NULL REFERENCES doctors(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_tc_no ON patients (tc_no);

-- ============================================================
-- 4. MAMOGRAFİ GÖRÜNTÜLERİ (mammography_images)
-- ============================================================
CREATE TABLE IF NOT EXISTS mammography_images (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id      UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    uploaded_by     UUID        NOT NULL REFERENCES doctors(id),

    -- Görüntü Dosya Bilgileri
    original_filename   VARCHAR(255) NOT NULL,
    storage_url         TEXT        NOT NULL,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(50) DEFAULT 'image/png',

    -- Mamografi Meta Verisi
    view_position       VARCHAR(20),
    laterality          VARCHAR(10) CHECK (laterality IN ('Sol', 'Sağ', 'İkili')),
    image_quality       VARCHAR(20),
    acquisition_date    DATE,
    equipment_model     VARCHAR(150),

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 5. ANALİZLER (analyses)
-- ============================================================
CREATE TABLE IF NOT EXISTS analyses (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

    -- İlişkiler
    doctor_id       UUID        NOT NULL REFERENCES doctors(id),
    patient_id      UUID        NOT NULL REFERENCES patients(id),
    image_id        UUID        NOT NULL REFERENCES mammography_images(id),

    -- Protokol / Vaka No
    protocol_no     VARCHAR(30) NOT NULL UNIQUE,

    -- Durum
    status          VARCHAR(30) NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),

    -- EfficientNet-B4 Model Çıktıları (sınıflandırma)
    malignancy_probability  DECIMAL(5,4),               -- 0.0000 – 1.0000 arası ham olasılık
    risk_level              VARCHAR(20)
                            CHECK (risk_level IN ('Düşük risk', 'İnceleniyor', 'Yüksek risk')),
    classification_label    VARCHAR(50),                -- 'Malign şüpheli', 'Benign', 'Normal'
    model_confidence        DECIMAL(5,4),               -- modelin güven skoru

    -- Model Bilgisi
    classification_model    VARCHAR(50) DEFAULT 'EfficientNet-B4',
    model_version           VARCHAR(30),                -- checkpoint/versiyon adı

    -- XAI Çıktıları (Grad-CAM++)
    xai_heatmap_url         TEXT,                       -- ısı haritası görüntüsünün URL'i
    xai_explanation         TEXT,                       -- varsa metinsel açıklama

    -- Doktor Notu / Klinik Karar
    doctor_notes            TEXT,
    final_decision          VARCHAR(50),
    is_reviewed             BOOLEAN NOT NULL DEFAULT FALSE,
    reviewed_at             TIMESTAMPTZ,

    -- Zaman Damgaları
    requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at            TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analyses_patient_id  ON analyses (patient_id);
CREATE INDEX IF NOT EXISTS idx_analyses_doctor_id   ON analyses (doctor_id);
CREATE INDEX IF NOT EXISTS idx_analyses_status      ON analyses (status);
CREATE INDEX IF NOT EXISTS idx_analyses_risk_level  ON analyses (risk_level);
CREATE INDEX IF NOT EXISTS idx_analyses_created_at  ON analyses (created_at DESC);

-- ============================================================
-- 6. DOKTOR OTURUM LOGLARI (doctor_sessions)
-- ============================================================
CREATE TABLE IF NOT EXISTS doctor_sessions (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id   UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    token_hash  TEXT        NOT NULL,
    ip_address  INET,
    user_agent  TEXT,
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked_at  TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 7. OTOMATİK updated_at TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_doctors_updated_at
    BEFORE UPDATE ON doctors
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_patients_updated_at
    BEFORE UPDATE ON patients
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_analyses_updated_at
    BEFORE UPDATE ON analyses
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 8. PROTOKOL NO ÜRETME FONKSİYONU
-- ============================================================
-- "MA-2025-0001" formatında otomatik protokol no üretir.
CREATE OR REPLACE FUNCTION generate_protocol_no()
RETURNS TEXT AS $$
DECLARE
    year_part TEXT;
    seq_num   INTEGER;
    proto     TEXT;
BEGIN
    year_part := TO_CHAR(NOW(), 'YYYY');
    SELECT COUNT(*) + 1 INTO seq_num
    FROM analyses
    WHERE EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW());
    proto := 'MA-' || year_part || '-' || LPAD(seq_num::TEXT, 4, '0');
    RETURN proto;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 9. BİLDİRİMLER (notifications) - Triyaj & Push Bildirimler
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    doctor_id       UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
    title           VARCHAR(200) NOT NULL,
    message         TEXT        NOT NULL,
    type            VARCHAR(30) NOT NULL DEFAULT 'info'
                    CHECK (type IN ('alert', 'warning', 'info', 'success')),
    link            TEXT,                           -- örn: /analyses/:id veya /patients/:id
    related_id      UUID,                           -- varsa analiz veya hasta ID'si
    is_read         BOOLEAN     NOT NULL DEFAULT FALSE,
    read_at         TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_doctor_id ON notifications (doctor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON notifications (doctor_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created   ON notifications (created_at DESC);

