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
export const sendEmail = async ({ to, cc, subject, text, html }) => {
  const transporter = createTransporter();

  const mailOptions = {
    from: process.env.EMAIL_FROM || '"212Learn" <212learn.support@gmail.com>',
    to,
    ...(cc && { cc }),
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
 * Pre-built: Contact Form Admin Notification Email
 */
export const sendContactNotificationEmail = async ({ name, email, phone, subject, message, to }) => {
  // Recipients: an explicit list (e.g. every admin account) when provided,
  // otherwise the ADMIN_EMAIL env address.
  const recipients = Array.isArray(to) && to.length
    ? to.join(', ')
    : (to || process.env.ADMIN_EMAIL || '212learn.support@gmail.com');

  const text = `Nouveau message de contact reçu sur 212Learn !

Nom: ${name}
Email: ${email}
Téléphone: ${phone || 'Non renseigné'}
Sujet: ${subject}

Message:
${message}
`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="background: #1B4B5A; color: #ffffff; padding: 15px 20px; border-radius: 8px 8px 0 0;">
        <h2 style="margin: 0; font-size: 18px;">📩 Nouveau message de contact 212Learn</h2>
      </div>
      <div style="padding: 20px; color: #1A1A2E;">
        <p style="margin-top: 0;"><strong>Nom complet:</strong> ${name}</p>
        <p><strong>Email:</strong> <a href="mailto:${email}">${email}</a></p>
        <p><strong>Téléphone:</strong> ${phone || 'Non renseigné'}</p>
        <p><strong>Sujet:</strong> <span style="color: #C1652F; font-weight: bold;">${subject}</span></p>
        <hr style="border: 0; border-top: 1px solid #e2e8f0; margin: 15px 0;" />
        <p style="margin-bottom: 5px; font-weight: bold;">Message:</p>
        <div style="background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #cbd5e1; white-space: pre-wrap; font-size: 14px;">${message}</div>
      </div>
      <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
        Notification automatique de la plateforme 212Learn
      </div>
    </div>
  `;

  try {
    return await sendEmail({
      to: recipients,
      subject: `[Contact 212Learn] ${subject} - ${name}`,
      text,
      html,
    });
  } catch (err) {
    console.warn('Failed sending admin notification email:', err.message);
  }
};

/**
 * Pre-built: Password Reset Email
 * @param {string} to           - Recipient email address
 * @param {string} firstName    - Recipient's first name
 * @param {string} resetLink    - Full URL the user clicks to reset their password
 */
export const sendPasswordResetEmail = async (to, firstName, resetLink) => {
  const subject = '🔑 Réinitialisation de votre mot de passe — 212Learn';

  const text = `Bonjour ${firstName},\n\nNous avons reçu une demande de réinitialisation de votre mot de passe.\n\nCliquez sur le lien ci-dessous (valable 5 minutes) :\n${resetLink}\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\n— L'équipe 212Learn`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Réinitialisation du mot de passe</h2>
      <p>Bonjour <strong>${firstName}</strong>,</p>
      <p>Nous avons reçu une demande de réinitialisation de votre mot de passe.</p>
      <p>Cliquez sur le bouton ci-dessous (le lien est valable <strong>5 minutes</strong>) :</p>
      <a href="${resetLink}"
         style="display:inline-block;padding:12px 24px;background-color:#6c63ff;color:#fff;
                text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
        Réinitialiser mon mot de passe
      </a>
      <p style="color:#666;font-size:13px;">
        Si vous n'avez pas fait cette demande, ignorez simplement cet email.<br>
        Ce lien expirera dans 5 minutes.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">© 212Learn — Plateforme d'apprentissage en ligne</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

/**
 * Pre-built: Account Restore OTP Email
 * @param {string} to           - Recipient email address
 * @param {string} firstName    - Recipient's first name
 * @param {string} otp          - 6-digit OTP code
 */
export const sendAccountRestoreOtpEmail = async (to, firstName, otp) => {
  const subject = '🔓 Restauration de votre compte — 212Learn';

  const text = `Bonjour ${firstName},\n\nNous avons détecté une tentative de connexion sur un compte désactivé.\n\nVotre code de restauration (valable 15 minutes) :\n\n  ${otp}\n\nEntrez ce code sur la page de connexion pour restaurer votre compte.\n\nSi vous n'avez pas fait cette demande, ignorez cet email.\n\n— L'équipe 212Learn`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Restauration de votre compte</h2>
      <p>Bonjour <strong>${firstName}</strong>,</p>
      <p>Nous avons détecté une tentative de connexion sur votre compte désactivé.</p>
      <p>Utilisez le code ci-dessous pour restaurer votre compte. Ce code est <strong>valable 15 minutes</strong> :</p>
      <div style="text-align:center;margin:28px 0;">
        <span style="display:inline-block;padding:18px 36px;background:#6c63ff;color:#fff;
                     font-size:32px;font-weight:bold;letter-spacing:10px;border-radius:10px;">
          ${otp}
        </span>
      </div>
      <p style="color:#444;">Entrez ce code sur la page de connexion pour restaurer votre compte.</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#666;font-size:13px;">
        Si vous n'avez pas fait cette demande, ignorez simplement cet email.<br>
        Ce code expirera dans 15 minutes.
      </p>
      <p style="color:#999;font-size:12px;">© 212Learn — Plateforme d'apprentissage en ligne</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};

/**
 * Pre-built: Email Verification
 * @param {string} to         - Recipient email address
 * @param {string} firstName  - Recipient's first name
 * @param {string} verifyLink - Full URL the user clicks to verify their email
 */
export const sendVerificationEmail = async (to, firstName, verifyLink) => {
  const subject = '✅ Confirmez votre adresse email — 212Learn';

  const text = `Bonjour ${firstName},\n\nMerci de vous être inscrit sur 212Learn !\n\nConfirmez votre adresse email en cliquant sur le lien ci-dessous (valable 48 heures) :\n${verifyLink}\n\nSi vous n'avez pas créé de compte, ignorez cet email.\n\n— L'équipe 212Learn`;

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1a1a2e;">Bienvenue sur 212Learn 🎉</h2>
      <p>Bonjour <strong>${firstName}</strong>,</p>
      <p>Merci de vous être inscrit ! Confirmez votre adresse email pour activer votre compte.</p>
      <p>Cliquez sur le bouton ci-dessous (le lien est valable <strong>48 heures</strong>) :</p>
      <a href="${verifyLink}"
         style="display:inline-block;padding:12px 24px;background-color:#6c63ff;color:#fff;
                text-decoration:none;border-radius:6px;font-weight:bold;margin:16px 0;">
        Confirmer mon email
      </a>
      <p style="color:#666;font-size:13px;">
        Si vous n'avez pas créé de compte, ignorez simplement cet email.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;">
      <p style="color:#999;font-size:12px;">© 212Learn — Plateforme d'apprentissage en ligne</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
};
