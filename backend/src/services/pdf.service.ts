import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { UPLOADS_DIR } from '../config/paths.js';

interface ReportData {
  analysis: {
    id: string;
    protocol_no: string;
    status: string;
    malignancy_probability: string | number | null;
    risk_level: string | null;
    classification_label: string | null;
    model_confidence: string | number | null;
    classification_model: string | null;
    model_version: string | null;
    xai_heatmap_url: string | null;
    xai_explanation: string | null;
    doctor_notes: string | null;
    final_decision: string | null;
    is_reviewed: boolean;
    reviewed_at: string | Date | null;
    requested_at: string | Date | null;
    completed_at: string | Date | null;
    patient: {
      id: string;
      tc_no: string;
      first_name: string;
      last_name: string;
      date_of_birth?: string;
      gender?: string;
      phone?: string;
    };
    image: {
      id: string;
      url: string;
      original_filename: string;
      laterality?: string | null;
      view_position?: string | null;
      acquisition_date?: string | null;
    };
  };
  doctor: {
    full_name: string;
    title?: string | null;
    specialty?: string | null;
    hospital?: string | null;
  };
}

export const generateAnalysisPdfBuffer = async (data: ReportData): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
      info: {
        Title: `MammoXai Raporu - ${data.analysis.protocol_no}`,
        Author: 'MammoXai AI Sistemi',
        Subject: 'Mamografi Analiz ve Karar Destek Raporu',
      },
    });

    const buffers: Buffer[] = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', (err) => reject(err));

    // UTF-8 Türkçe desteği için font ayarı (Windows Arial veya standart Helvetica fallback)
    const winArialRegular = 'C:\\Windows\\Fonts\\arial.ttf';
    const winArialBold = 'C:\\Windows\\Fonts\\arialbd.ttf';
    const hasArial = fs.existsSync(winArialRegular);

    const fontRegular = hasArial ? winArialRegular : 'Helvetica';
    const fontBold = (hasArial && fs.existsSync(winArialBold)) ? winArialBold : 'Helvetica-Bold';

    const { analysis, doctor } = data;
    const patient = analysis.patient;
    const image = analysis.image;

    // ─── Header & Logo ───
    doc.rect(40, 40, 515, 55).fill('#0f172a'); // Koyu lacivert başlık bandı
    doc.fillColor('#ffffff').font(fontBold).fontSize(18).text('MAMMOXAI', 55, 52);
    doc.font(fontRegular).fontSize(9).fillColor('#94a3b8').text('Yapay Zeka Destekli Mamografi Analiz ve XAI Raporu', 55, 74);

    doc.font(fontBold).fontSize(10).fillColor('#38bdf8').text(`Protokol: ${analysis.protocol_no}`, 370, 52, { align: 'right', width: 170 });
    const reportDate = analysis.completed_at ? new Date(analysis.completed_at).toLocaleDateString('tr-TR') : new Date().toLocaleDateString('tr-TR');
    doc.font(fontRegular).fontSize(8).fillColor('#cbd5e1').text(`Rapor Tarihi: ${reportDate}`, 370, 72, { align: 'right', width: 170 });

    let currentY = 110;

    // ─── Hasta ve Hekim Bilgileri (2 Kolon) ───
    const boxWidth = 250;
    const boxHeight = 85;

    // Hasta Bilgileri Kutusu
    doc.roundedRect(40, currentY, boxWidth, boxHeight, 6).lineWidth(1).stroke('#e2e8f0');
    doc.rect(40, currentY, boxWidth, 22).fill('#f1f5f9');
    doc.fillColor('#1e293b').font(fontBold).fontSize(10).text('HASTA BİLGİLERİ', 50, currentY + 6);
    
    doc.font(fontRegular).fontSize(9).fillColor('#334155');
    doc.text(`Adı Soyadı: ${patient.first_name} ${patient.last_name}`, 50, currentY + 28);
    doc.text(`TC Kimlik No: ${patient.tc_no}`, 50, currentY + 44);
    const dob = patient.date_of_birth ? new Date(patient.date_of_birth).toLocaleDateString('tr-TR') : '-';
    doc.text(`Doğum Tarihi: ${dob}  |  Cinsiyet: ${patient.gender ?? 'Kadın'}`, 50, currentY + 60);

    // Hekim & Kurum Bilgileri Kutusu
    const rightBoxX = 305;
    doc.roundedRect(rightBoxX, currentY, boxWidth, boxHeight, 6).lineWidth(1).stroke('#e2e8f0');
    doc.rect(rightBoxX, currentY, boxWidth, 22).fill('#f1f5f9');
    doc.fillColor('#1e293b').font(fontBold).fontSize(10).text('SORUMLU HEKİM & KURUM', rightBoxX + 10, currentY + 6);

    doc.font(fontRegular).fontSize(9).fillColor('#334155');
    const doctorTitle = [doctor.title, doctor.full_name].filter(Boolean).join(' ');
    doc.text(`Hekim: ${doctorTitle}`, rightBoxX + 10, currentY + 28);
    doc.text(`Uzmanlık: ${doctor.specialty || 'Radyoloji / Genel Cerrahi'}`, rightBoxX + 10, currentY + 44);
    doc.text(`Hastane: ${doctor.hospital || 'MammoXai Tıp Merkezi'}`, rightBoxX + 10, currentY + 60);

    currentY += 100;

    // ─── AI Model Analiz Sonuçları ───
    doc.roundedRect(40, currentY, 515, 105, 6).lineWidth(1).stroke('#cbd5e1');
    doc.rect(40, currentY, 515, 24).fill('#0284c7');
    doc.fillColor('#ffffff').font(fontBold).fontSize(10).text('YAPAY ZEKA (AI) ANALİZ BULGULARI', 50, currentY + 7);

    // Risk rengi belirleme
    const risk = analysis.risk_level || 'Belirtilmedi';
    let riskBg = '#22c55e'; // Yeşil
    if (risk.includes('Yüksek')) riskBg = '#ef4444'; // Kırmızı
    else if (risk.includes('İnceleniyor') || risk.includes('Orta')) riskBg = '#f59e0b'; // Turuncu

    // Risk Rozeti
    doc.roundedRect(400, currentY + 34, 140, 32, 4).fill(riskBg);
    doc.fillColor('#ffffff').font(fontBold).fontSize(11).text(risk.toUpperCase(), 400, currentY + 44, { align: 'center', width: 140 });

    doc.fillColor('#0f172a').font(fontBold).fontSize(9);
    doc.text('Sınıflandırma Teşhisi:', 55, currentY + 36);
    doc.font(fontRegular).text(analysis.classification_label || 'Normal / Malign bulgu yok', 180, currentY + 36);

    doc.font(fontBold).text('Malignite Olasılığı:', 55, currentY + 52);
    const prob = analysis.malignancy_probability !== null ? `%${(Number(analysis.malignancy_probability) * 100).toFixed(1)}` : '-';
    doc.font(fontRegular).text(prob, 180, currentY + 52);

    doc.font(fontBold).text('Model Güven Skoru:', 55, currentY + 68);
    const conf = analysis.model_confidence !== null ? `%${(Number(analysis.model_confidence) * 100).toFixed(1)}` : '-';
    doc.font(fontRegular).text(conf, 180, currentY + 68);

    doc.font(fontBold).text('Kullanılan Model & XAI:', 55, currentY + 84);
    doc.font(fontRegular).text(`${analysis.classification_model || 'EfficientNet-B4'} | Grad-CAM++ Isı Haritası`, 180, currentY + 84);

    currentY += 120;

    // ─── Görüntüler (Orijinal Mamografi & Grad-CAM++ Isı Haritası) ───
    doc.font(fontBold).fontSize(10).fillColor('#0f172a').text('GÖRSEL İNCELEME & AÇIKLANABİLİR YAPAY ZEKA (XAI)', 40, currentY);
    currentY += 16;

    const imgWidth = 245;
    const imgHeight = 160;

    // Orijinal Mamografi
    let mammoRendered = false;
    if (image?.url) {
      const relativePath = image.url.replace(/^\/uploads\//, '');
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          doc.image(fullPath, 40, currentY, { fit: [imgWidth, imgHeight], align: 'center', valign: 'center' });
          mammoRendered = true;
        } catch {
          // dosya bozuk veya okunamıyorsa fallback kutusu
        }
      }
    }
    if (!mammoRendered) {
      doc.roundedRect(40, currentY, imgWidth, imgHeight, 4).lineWidth(1).stroke('#e2e8f0');
      doc.fillColor('#94a3b8').font(fontRegular).fontSize(9).text('Mamografi Görüntüsü', 40, currentY + 70, { align: 'center', width: imgWidth });
    }
    doc.fillColor('#475569').font(fontRegular).fontSize(8).text('Orijinal Mamografi Görüntüsü', 40, currentY + imgHeight + 4, { align: 'center', width: imgWidth });

    // Isı Haritası
    let heatmapRendered = false;
    if (analysis?.xai_heatmap_url) {
      const relativePath = analysis.xai_heatmap_url.replace(/^\/uploads\//, '');
      const fullPath = path.join(UPLOADS_DIR, relativePath);
      if (fs.existsSync(fullPath)) {
        try {
          doc.image(fullPath, 310, currentY, { fit: [imgWidth, imgHeight], align: 'center', valign: 'center' });
          heatmapRendered = true;
        } catch {
          // fallback
        }
      }
    }
    if (!heatmapRendered) {
      doc.roundedRect(310, currentY, imgWidth, imgHeight, 4).lineWidth(1).stroke('#e2e8f0');
      doc.fillColor('#94a3b8').font(fontRegular).fontSize(9).text('Grad-CAM++ Isı Haritası', 310, currentY + 70, { align: 'center', width: imgWidth });
    }
    doc.fillColor('#475569').font(fontRegular).fontSize(8).text('Grad-CAM++ Odak Haritası', 310, currentY + imgHeight + 4, { align: 'center', width: imgWidth });

    currentY += imgHeight + 25;

    // ─── Doktor Klinik Değerlendirmesi & Kararı ───
    doc.roundedRect(40, currentY, 515, 80, 6).lineWidth(1).stroke('#cbd5e1');
    doc.rect(40, currentY, 515, 20).fill('#334155');
    doc.fillColor('#ffffff').font(fontBold).fontSize(9).text('HEKİM KLİNİK DEĞERLENDİRMESİ VE NİHAİ KARAR', 50, currentY + 5);

    doc.fillColor('#0f172a').font(fontBold).fontSize(9);
    doc.text('Klinik Karar:', 50, currentY + 28);
    const decisionText = analysis.final_decision || (analysis.is_reviewed ? 'İncelendi' : 'Henüz Değerlendirilmedi');
    doc.font(fontRegular).text(decisionText, 130, currentY + 28);

    doc.font(fontBold).text('Hekim Notu:', 50, currentY + 44);
    const notesText = analysis.doctor_notes || 'Klinik not girilmedi.';
    doc.font(fontRegular).text(notesText, 130, currentY + 44, { width: 400 });

    const reviewDate = analysis.reviewed_at ? new Date(analysis.reviewed_at).toLocaleDateString('tr-TR') : '-';
    doc.font(fontRegular).fontSize(8).fillColor('#64748b').text(`Değerlendirme Tarihi: ${reviewDate}`, 50, currentY + 64);

    currentY += 95;

    // ─── Footer / Yasal Uyarı ───
    doc.rect(40, 780, 515, 0.5).fill('#cbd5e1');
    doc.font(fontRegular).fontSize(7).fillColor('#94a3b8').text(
      'YASAL UYARI: Bu rapor MammoXai yapay zeka karar destek sistemi tarafından üretilmiştir. Kesin tanı yerine geçmez; sonuçlar uzman hekim tarafından klinik bulgular ve biyopsi/tetkiklerle birlikte değerlendirilmelidir.',
      40,
      787,
      { align: 'center', width: 515 }
    );

    doc.end();
  });
};
