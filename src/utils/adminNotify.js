/**
 * Admin notification helpers.
 *
 * These are best-effort side effects: they must never break the request that
 * triggers them, so every function swallows its own errors and only logs.
 */
import prisma from '../config/prisma.js';
import { sendEmail, sendContactNotificationEmail } from './email.js';

/**
 * Resolve the list of recipient emails for admin notifications: every active
 * admin account, falling back to the ADMIN_EMAIL env address if none exist.
 * @returns {Promise<string[]>}
 */
export const resolveAdminRecipients = async () => {
  const admins = await prisma.user.findMany({
    where: { role: 'admin', deletedAt: null },
    select: { email: true },
  });
  const emails = admins.map((a) => a.email).filter(Boolean);
  if (emails.length > 0) return emails;

  const fallback = process.env.ADMIN_EMAIL || '212learn.support@gmail.com';
  return [fallback];
};

/**
 * Notify all admins that a student's paid enrollment is awaiting manual
 * approval (payment moved to WAITING_VERIFICATION). Best-effort / non-blocking.
 *
 * @param {object} args
 * @param {string} args.userId   - Enrolling student's user id
 * @param {string} args.courseId - Course the student enrolled in
 * @param {number|string} [args.amount]
 * @param {string} [args.currency]
 * @param {string} [args.provider]  - 'wafacash' | 'transfer'
 * @param {string} [args.reference] - Payment transaction reference
 * @param {string} [args.couponId]  - Coupon ID if used
 */
export const notifyAdminsEnrollmentPendingApproval = async ({
  userId,
  courseId,
  amount,
  currency = 'MAD',
  provider,
  reference,
  couponId,
}) => {
  try {
    const [student, course, coupon, recipients] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { title: true, price: true },
      }),
      couponId ? prisma.coupon.findUnique({
        where: { id: couponId },
        select: { code: true, discount: true },
      }) : null,
      resolveAdminRecipients(),
    ]);

    if (!recipients.length) return;

    const studentName = student
      ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email
      : 'Un étudiant';
    const studentEmail = student?.email || '—';
    const courseTitle = course?.title || 'un cours';
    const originalPrice = course?.price ? Number(course.price) : null;
    const finalAmount = amount != null ? Number(amount) : null;
    const providerLabel = provider === 'transfer' ? 'Virement bancaire' : provider === 'wafacash' ? 'Wafacash' : (provider || '—');
    const frontendUrl = (process.env.FRONTEND_URL || 'https://212-learn.vercel.app').replace(/\/$/, '');
    const dashboardLink = `${frontendUrl}/admin/dashboard?tab=payments`;

    // Build price display: show the original price, the coupon, and the final
    // amount so the admin sees the full breakdown (not just the discounted total).
    let priceDisplay = '';
    if (finalAmount != null) {
      if (coupon && originalPrice && finalAmount < originalPrice) {
        const discountPercent = coupon.discount ? Number(coupon.discount) : 0;
        const saved = (originalPrice - finalAmount).toFixed(2);
        priceDisplay = `${finalAmount} ${currency} `
          + `(prix initial ${originalPrice} ${currency} · coupon ${coupon.code} −${discountPercent}% · économie ${saved} ${currency})`;
      } else {
        priceDisplay = `${finalAmount} ${currency}`;
      }
    } else {
      priceDisplay = '—';
    }

    const text = `Nouvelle inscription en attente de validation sur 212Learn.

Étudiant : ${studentName} (${studentEmail})
Cours : ${courseTitle}
Montant : ${priceDisplay}
Méthode : ${providerLabel}
Référence : ${reference || '—'}

L'étudiant a soumis sa preuve de paiement et attend votre validation.
Validez ou refusez son inscription depuis le tableau de bord admin :
${dashboardLink}
`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: #1B4B5A; color: #ffffff; padding: 15px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">🎓 Inscription en attente de validation</h2>
        </div>
        <div style="padding: 20px; color: #1A1A2E;">
          <p style="margin-top: 0;">Un étudiant a soumis sa preuve de paiement et attend votre validation.</p>
          <p><strong>Étudiant :</strong> ${studentName} (<a href="mailto:${studentEmail}">${studentEmail}</a>)</p>
          <p><strong>Cours :</strong> <span style="color: #C1652F; font-weight: bold;">${courseTitle}</span></p>
          <p><strong>Montant :</strong> ${priceDisplay}</p>
          <p><strong>Méthode :</strong> ${providerLabel}</p>
          <p><strong>Référence :</strong> ${reference || '—'}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${dashboardLink}"
               style="display:inline-block;padding:12px 24px;background-color:#C1652F;color:#fff;
                      text-decoration:none;border-radius:6px;font-weight:bold;">
              Valider l'inscription
            </a>
          </div>
        </div>
        <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
          Notification automatique de la plateforme 212Learn
        </div>
      </div>
    `;

    await sendEmail({
      to: recipients.join(', '),
      subject: `[212Learn] Inscription à valider — ${studentName} · ${courseTitle}`,
      text,
      html,
    });
  } catch (err) {
    // Never let a notification failure break the payment flow.
    console.warn('Failed sending admin enrollment-approval email:', err.message);
  }
};

/**
 * Notify all admins that a student's pack purchase is awaiting manual approval.
 * Best-effort / non-blocking.
 * @param {{userId:string,packTitle?:string,amount?:number|string,currency?:string,provider?:string,reference?:string}} args
 */
export const notifyAdminsPackPurchasePendingApproval = async ({
  userId,
  packTitle,
  amount,
  currency = 'MAD',
  provider,
  reference,
}) => {
  try {
    const [student, recipients] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, lastName: true, email: true },
      }),
      resolveAdminRecipients(),
    ]);
    if (!recipients.length) return;

    const studentName = student
      ? `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.email
      : 'Un étudiant';
    const studentEmail = student?.email || '—';
    const providerLabel = provider === 'transfer' ? 'Virement bancaire' : provider === 'wafacash' ? 'Wafacash' : (provider || '—');
    const amountLabel = amount != null ? `${Number(amount)} ${currency}` : '—';
    const frontendUrl = (process.env.FRONTEND_URL || 'https://212-learn.vercel.app').replace(/\/$/, '');
    const dashboardLink = `${frontendUrl}/admin/dashboard?tab=payments`;

    const text = `Nouvel achat de pack en attente de validation sur 212Learn.

Étudiant : ${studentName} (${studentEmail})
Pack : ${packTitle || 'un pack'}
Montant : ${amountLabel}
Méthode : ${providerLabel}
Référence : ${reference || '—'}

Validez ou refusez l'achat depuis le tableau de bord admin :
${dashboardLink}
`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
        <div style="background: #1B4B5A; color: #ffffff; padding: 15px 20px; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">📦 Achat de pack en attente de validation</h2>
        </div>
        <div style="padding: 20px; color: #1A1A2E;">
          <p style="margin-top: 0;">Un étudiant a soumis sa preuve de paiement pour un pack.</p>
          <p><strong>Étudiant :</strong> ${studentName} (<a href="mailto:${studentEmail}">${studentEmail}</a>)</p>
          <p><strong>Pack :</strong> <span style="color: #C1652F; font-weight: bold;">${packTitle || 'un pack'}</span></p>
          <p><strong>Montant :</strong> ${amountLabel}</p>
          <p><strong>Méthode :</strong> ${providerLabel}</p>
          <p><strong>Référence :</strong> ${reference || '—'}</p>
          <div style="text-align:center;margin:24px 0;">
            <a href="${dashboardLink}"
               style="display:inline-block;padding:12px 24px;background-color:#C1652F;color:#fff;
                      text-decoration:none;border-radius:6px;font-weight:bold;">
              Valider l'achat
            </a>
          </div>
        </div>
        <div style="font-size: 12px; color: #64748b; text-align: center; margin-top: 20px; padding-top: 15px; border-top: 1px solid #f1f5f9;">
          Notification automatique de la plateforme 212Learn
        </div>
      </div>
    `;

    await sendEmail({
      to: recipients.join(', '),
      subject: `[212Learn] Achat de pack à valider — ${studentName} · ${packTitle || 'pack'}`,
      text,
      html,
    });
  } catch (err) {
    console.warn('Failed sending admin pack-purchase email:', err.message);
  }
};

/**
 * Notify all admins that a visitor submitted the contact form. Best-effort /
 * non-blocking — resolves every active admin account and reuses the contact
 * email template.
 * @param {{name:string,email:string,phone?:string,subject:string,message:string}} msg
 */
export const notifyAdminsContactMessage = async (msg) => {
  try {
    const to = await resolveAdminRecipients();
    await sendContactNotificationEmail({ ...msg, to });
  } catch (err) {
    console.warn('Failed sending admin contact email:', err.message);
  }
};
