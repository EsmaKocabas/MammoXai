
import nodemailer from 'nodemailer';

const smtpPort = Number(process.env.SMTP_PORT || 587);

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: smtpPort,
    secure: smtpPort === 465,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export async function sendPasswordResetEmail(
    email: string,
    resetUrl: string,
) {
    await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: email,
        subject: 'Şifre sıfırlama bağlantısı',
        text: `Şifrenizi yenilemek için bu bağlantıyı açın: ${resetUrl}\n\nBu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.`,
        html: `
      <p>Şifrenizi yenilemek için aşağıdaki bağlantıya tıklayın:</p>
      <p><a href="${resetUrl}">Şifremi yenile</a></p>
      <p>Bu talebi siz yapmadıysanız bu e-postayı yok sayabilirsiniz.</p>
    `,
    });
}
