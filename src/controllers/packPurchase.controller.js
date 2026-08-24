import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';
import { isOurCloudinaryUrl } from '../config/cloudinary.js';
import { PAYMENT_STATUS } from '../constants/payment.js';
import { logAuditEvent } from '../utils/audit.js';
import { notifyAdminsPackPurchasePendingApproval } from '../utils/adminNotify.js';
import {
  PLATFORM_COMMISSION_PCT,
  computePackPricing,
  computeRevenueSplit,
  soldCountForPack,
} from './pack.controller.js';

const ACTIVE_STATUSES = [PAYMENT_STATUS.PENDING, PAYMENT_STATUS.WAITING_VERIFICATION, PAYMENT_STATUS.PAID];

const generatePackReference = (provider) => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const prefix = provider === 'transfer' ? 'PKT-' : 'PKW-';
  let ref = prefix;
  for (let i = 0; i < 8; i++) ref += chars.charAt(Math.floor(Math.random() * chars.length));
  return ref;
};

const packInclude = {
  courses: {
    include: {
      course: { select: { id: true, title: true } },
      instructor: { select: { id: true, firstName: true, lastName: true } },
    },
  },
};

// ─── POST /api/v1/pack-payments/request ──────────────────────────────────────
// Student initiates a pack purchase (provider: 'wafacash' | 'transfer').
// Locks the price (launch or normal) based on seats available right now.
export const requestPackPurchase = async (req, res, next) => {
  try {
    if (!req.user.isVerified) {
      return next(new AppError(
        "Veuillez confirmer votre adresse email avant d'acheter un pack. Vérifiez votre boîte de réception.",
        403, 'EMAIL_NOT_VERIFIED',
      ));
    }

    validateRequired(req.body, ['packId']);
    const { packId } = req.body;
    validateUUID(packId, 'packId');
    const provider = req.body.provider === 'transfer' ? 'transfer' : 'wafacash';
    const userId = req.user.id;

    const pack = await prisma.pack.findFirst({
      where: { id: packId, deletedAt: null },
      include: packInclude,
    });
    if (!pack) return next(new AppError('Pack introuvable.', 404, 'NOT_FOUND'));
    if (pack.status !== 'published') {
      return next(new AppError("Ce pack n'est pas disponible à l'achat.", 400, 'BAD_REQUEST'));
    }

    // A student may not open two active purchases for the same pack.
    const active = await prisma.packPurchase.findFirst({
      where: { packId, userId, status: { in: ACTIVE_STATUSES } },
    });
    if (active) {
      if (active.status === PAYMENT_STATUS.PAID) {
        return next(new AppError('Vous avez déjà acheté ce pack.', 409, 'CONFLICT'));
      }
      return res.status(200).json(successResponse({
        message: `Vous avez déjà une demande d'achat en cours (statut : ${active.status}).`,
        purchaseId: active.id,
        paymentReference: active.transactionReference,
        amount: Number(active.amount).toFixed(2),
        status: active.status,
      }));
    }

    // Lock the price at purchase time. seatsLeft is derived from all non-rejected
    // purchases, so the first `launchSeats` buyers get the launch price.
    const soldCount = await soldCountForPack(packId);
    const pricing = computePackPricing(pack, soldCount);
    const amount = pricing.currentPrice;
    const isLaunchPrice = pricing.launchPrice != null && pricing.seatsLeft > 0
      && amount === pricing.launchPrice;

    // Clean up a previous rejected purchase so the student can retry cleanly.
    await prisma.packPurchase.deleteMany({ where: { packId, userId, status: PAYMENT_STATUS.REJECTED } });

    const purchase = await prisma.packPurchase.create({
      data: {
        packId,
        userId,
        amount,
        currency: pack.currency || 'MAD',
        provider,
        transactionReference: generatePackReference(provider),
        status: PAYMENT_STATUS.PENDING,
        isLaunchPrice,
      },
    });

    const base = {
      message: 'Demande d\'achat du pack initialisée.',
      purchaseId: purchase.id,
      paymentReference: purchase.transactionReference,
      amount: Number(purchase.amount).toFixed(2),
      currency: purchase.currency,
      isLaunchPrice,
      seatsLeft: pricing.seatsLeft,
    };

    if (provider === 'transfer') {
      base.bankInfo = {
        bankName: 'Attijariwafa Bank',
        accountName: '212Learn SARL',
        rib: process.env.BANK_RIB || '01178000011800000000123456',
        iban: process.env.BANK_IBAN || 'MA89 0117 8000 0118 0000 0000 1234 56',
        swift: process.env.BANK_SWIFT || 'CWBAMAMM',
      };
      base.instructions = {
        step1: 'Effectuez un virement au compte ci-dessus.',
        step2: `Indiquez la référence ${purchase.transactionReference} dans le libellé.`,
        step3: `Montant : ${Number(purchase.amount).toFixed(2)} MAD`,
        step4: 'Téléversez le reçu de virement et votre RIB depuis votre tableau de bord.',
      };
    } else {
      base.instructions = {
        step1: 'Rendez-vous dans une agence Wafacash au Maroc.',
        step2: `Communiquez la référence : ${purchase.transactionReference}`,
        step3: `Payez le montant : ${Number(purchase.amount).toFixed(2)} MAD`,
        step4: 'Téléversez le reçu et saisissez le code MTCN (10 chiffres) depuis votre tableau de bord.',
      };
    }

    res.status(201).json(successResponse(base));
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/pack-payments/submit ───────────────────────────────────────
// Student submits proof of payment (wafacash: mtcn + receipt; transfer: rib + receipt).
// Moves PENDING/REJECTED → WAITING_VERIFICATION.
export const submitPackPayment = async (req, res, next) => {
  try {
    validateRequired(req.body, ['paymentReference']);
    const { paymentReference } = req.body;

    const purchase = await prisma.packPurchase.findFirst({
      where: { transactionReference: paymentReference, userId: req.user.id },
      include: { pack: { select: { id: true, title: true } } },
    });
    if (!purchase) return next(new AppError('Demande d\'achat introuvable.', 404, 'NOT_FOUND'));
    if (purchase.status === PAYMENT_STATUS.PAID) {
      return next(new AppError('Cet achat a déjà été validé.', 409, 'CONFLICT'));
    }

    // Resolve the receipt URL (file upload → Cloudinary URL; or a client-supplied
    // URL that must live on OUR Cloudinary account to avoid stored phishing links).
    let receiptUrl = req.file?.path || req.body.receiptUrl || req.body.transferReceiptUrl || null;
    if (!req.file && receiptUrl && !isOurCloudinaryUrl(receiptUrl)) {
      return next(new AppError('Le reçu doit être un fichier téléversé sur notre compte Cloudinary.', 400, 'VALIDATION_ERROR'));
    }

    const data = { status: PAYMENT_STATUS.WAITING_VERIFICATION };

    if (purchase.provider === 'transfer') {
      validateRequired(req.body, ['rib']);
      const cleanRib = String(req.body.rib).trim().replace(/\s/g, '');
      if (!/^\d{24}$/.test(cleanRib)) {
        return next(new AppError('Le RIB doit comporter exactement 24 chiffres.', 400, 'VALIDATION_ERROR'));
      }
      data.rib = cleanRib;
      data.transferReceiptUrl = receiptUrl || purchase.transferReceiptUrl;
    } else {
      validateRequired(req.body, ['mtcn']);
      const cleanMtcn = String(req.body.mtcn).trim();
      if (!/^\d{10}$/.test(cleanMtcn)) {
        return next(new AppError('Le code MTCN doit comporter exactement 10 chiffres.', 400, 'VALIDATION_ERROR'));
      }
      data.mtcn = cleanMtcn;
      data.receiptUrl = receiptUrl || purchase.receiptUrl;
    }

    const updated = await prisma.packPurchase.update({ where: { id: purchase.id }, data });

    notifyAdminsPackPurchasePendingApproval({
      userId: req.user.id,
      packTitle: purchase.pack?.title,
      amount: updated.amount,
      currency: updated.currency,
      provider: updated.provider,
      reference: paymentReference,
    }).catch(() => {});

    logAuditEvent(req.user.id, 'SUBMIT_PACK_PAYMENT', 'PackPurchase', updated.id, {
      provider: updated.provider, status: updated.status, amount: updated.amount, packId: purchase.packId,
    }).catch(() => {});

    res.status(200).json(successResponse({
      purchaseId: updated.id,
      status: updated.status,
      message: 'Preuve de paiement soumise. En attente de validation par un administrateur.',
    }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/pack-payments/mine ──────────────────────────────────────────
export const getMyPackPurchases = async (req, res, next) => {
  try {
    const purchases = await prisma.packPurchase.findMany({
      where: { userId: req.user.id },
      include: { pack: { include: packInclude } },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(successResponse({ purchases }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/pack-payments/pending (admin) ───────────────────────────────
export const getPendingPackPurchases = async (req, res, next) => {
  try {
    const { status, provider } = req.query;
    const where = {};
    if (provider === 'wafacash' || provider === 'transfer') where.provider = provider;
    if (status === 'paid' || status === 'PAID') where.status = PAYMENT_STATUS.PAID;
    else if (status === 'rejected' || status === 'REJECTED') where.status = PAYMENT_STATUS.REJECTED;
    else if (status === 'pending' || status === 'PENDING' || status === 'WAITING_VERIFICATION') {
      where.status = { in: [PAYMENT_STATUS.WAITING_VERIFICATION, PAYMENT_STATUS.PENDING] };
    }

    const purchases = await prisma.packPurchase.findMany({
      where,
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        pack: { include: packInclude },
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    res.status(200).json(successResponse({ purchases }));
  } catch (error) {
    next(error);
  }
};

/**
 * Grant course access + write the revenue-share ledger for an approved pack
 * purchase. Runs inside the caller's transaction. The pack price is split
 * equally across its courses; each course's chosen instructor is credited the
 * share minus the platform commission.
 */
const settlePackPurchase = async (tx, purchase, adminId) => {
  const pack = await tx.pack.findUnique({
    where: { id: purchase.packId },
    include: { courses: true },
  });
  if (!pack || pack.courses.length === 0) {
    throw new AppError("Ce pack n'a aucun cours — impossible de finaliser.", 400, 'PACK_EMPTY');
  }

  const { grossEach, commissionEach, netEach } = computeRevenueSplit(purchase.amount, pack.courses.length);

  let index = 0;
  for (const pc of pack.courses) {
    index += 1;
    // Grant access: ensure an enrollment exists with a PAID payment so the
    // existing checkEnrollment gate unlocks the course content.
    const existing = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId: purchase.userId, courseId: pc.courseId } },
      include: { payment: true },
    });

    if (!existing) {
      const enrollment = await tx.enrollment.create({
        data: { userId: purchase.userId, courseId: pc.courseId },
      });
      await tx.payment.create({
        data: {
          enrollmentId: enrollment.id,
          amount: grossEach,
          currency: purchase.currency,
          provider: purchase.provider,
          transactionReference: `${purchase.transactionReference}-${index}`,
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          verifiedBy: adminId,
          verifiedAt: new Date(),
          notes: `Pack : ${pack.title}`,
        },
      });
    } else if (!existing.payment) {
      await tx.payment.create({
        data: {
          enrollmentId: existing.id,
          amount: grossEach,
          currency: purchase.currency,
          provider: purchase.provider,
          transactionReference: `${purchase.transactionReference}-${index}`,
          status: PAYMENT_STATUS.PAID,
          paidAt: new Date(),
          verifiedBy: adminId,
          verifiedAt: new Date(),
          notes: `Pack : ${pack.title}`,
        },
      });
    } else if (existing.payment.status !== PAYMENT_STATUS.PAID) {
      await tx.payment.update({
        where: { id: existing.payment.id },
        data: { status: PAYMENT_STATUS.PAID, paidAt: new Date(), verifiedBy: adminId, verifiedAt: new Date() },
      });
    }
    // If already PAID (student bought this course separately), leave it untouched.

    // Ledger entry — instructor still earns their pack share regardless.
    await tx.revenueShare.create({
      data: {
        packPurchaseId: purchase.id,
        packId: pack.id,
        courseId: pc.courseId,
        instructorId: pc.instructorId,
        grossAmount: grossEach,
        commissionPct: PLATFORM_COMMISSION_PCT,
        commissionAmount: commissionEach,
        netAmount: netEach,
        currency: purchase.currency,
        status: 'pending',
      },
    });
  }
};

// ─── PATCH /api/v1/pack-payments/verify (admin) ──────────────────────────────
// Approve → grant all course enrollments + write revenue shares. Reject → close.
export const verifyPackPurchase = async (req, res, next) => {
  try {
    const { purchaseId, action, notes } = req.body;
    if (!purchaseId || !['approve', 'reject'].includes(action)) {
      return next(new AppError('purchaseId et action ("approve" | "reject") sont requis.', 400, 'VALIDATION_ERROR'));
    }
    validateUUID(purchaseId, 'purchaseId');

    const purchase = await prisma.packPurchase.findUnique({ where: { id: purchaseId } });
    if (!purchase) return next(new AppError('Achat introuvable.', 404, 'NOT_FOUND'));
    if (purchase.status === PAYMENT_STATUS.PAID) {
      return next(new AppError('Cet achat est déjà validé.', 409, 'CONFLICT'));
    }

    const updated = await prisma.$transaction(async (tx) => {
      const locked = await tx.packPurchase.findUnique({ where: { id: purchaseId } });
      if (locked.status === PAYMENT_STATUS.PAID) {
        throw new AppError('Achat déjà traité par une autre requête.', 409, 'CONFLICT');
      }

      if (action === 'approve') {
        await settlePackPurchase(tx, locked, req.user.id);
      }

      return tx.packPurchase.update({
        where: { id: purchaseId },
        data: {
          status: action === 'approve' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.REJECTED,
          paidAt: action === 'approve' ? new Date() : null,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          notes: notes || null,
        },
      });
    });

    res.status(200).json(successResponse({
      purchaseId,
      status: updated.status,
      message: action === 'approve'
        ? 'Achat validé. Accès aux cours du pack débloqué et revenus formateurs enregistrés.'
        : 'Achat refusé.',
      notes: updated.notes,
    }));
  } catch (error) {
    next(error);
  }
};
