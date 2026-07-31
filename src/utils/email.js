/**
 * Email Utility — wraps Nodemailer with a simple send helper.
 * Configure via environment variables:
 *   EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 *
 * For development, set EMAIL_MOCK=true to skip real sending and
 * just log the email to the console instead.
 */

import nodemailer from 'nodemailer';

// ── Build a transporter ────────────────────────────────────────────────────────
const createTransporter = () => {
  // Mock mode: just log the mail, never connect to an SMTP server
  if (process.env.EMAIL_MOCK === 'true') {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host:   process.env.EMAIL_HOST   || 'smtp.gmail.com',
    port:   Number(process.env.EMAIL_PORT) || 587,
    secure: Number(process.env.EMAIL_PORT) === 465, // true only for port 465
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });
};

/**
 * Send an email.
 * @param {object} options
 * @param {string} options.to        - Recipient email
 * @param {string} options.subject   - Email subject
 * @param {string} options.text      - Plain-text body (fallback)
 * @param {string} [options.html]    - HTML body (optional)
 */
export const sendEmail = async ({ to, subject, text, html }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"212Learn" <212learn.support@gmail.com>',
    to,
    subject,
    text,
    ...(html && { html }),
  };

  if (process.env.EMAIL_MOCK === 'true') {
    // In mock mode, log instead of sending
    const info = await transporter.sendMail(mailOptions);
    console.log('[EMAIL MOCK] Message: %s', JSON.stringify(JSON.parse(info.message), null, 2));
    return info;
  }

  return transporter.sendMail(mailOptions);
};

/**
 * Pre-built: Password Reset Email
 * @param {string} to           - Recipient email address
 * @param {string} firstName    - Recipient's first name
 * @param {string} resetLink    - Full URL the user clicks to reset their password
 */
export const sendPasswordResetEmail = async (to, firstName, resetLink) => {
  const subject = '🔑 Réinitialisation de votre mot de passe — 212Learn';

  const text = `Bonjour ${firstName},\n\nNous avons reçu une demande de réinitialisation de votre mot de passe.\n\nCliquez sur le lien ci-dessous (valable 15 minutes) :\n${resetLink}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\n— L'équipe 212Learn`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Réinitialisation du mot de passe</h2>
      <p>Bonjour <strong>${firstName}</strong>,</p>
      <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous (le lien est valable <strong>15 minutes</strong>) :</p>
      <a href="${resetLink}"
         style="display:inline-block;padding:12px 24px;background-color:#6c63ff;color:#fff;
                text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color:#666;font-size:13px;">
        Si vous n'avez pas fait cette demande, ignorez simplement cet email.<br>
        Ce lien expirera dans 15 minutes.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">© 212Learn — Plateforme d'apprentissage en ligne</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};
