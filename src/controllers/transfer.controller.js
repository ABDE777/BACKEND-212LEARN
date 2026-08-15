import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';
import { resolveValidCoupon, applyCouponDiscount, consumeCouponUsage } from '../utils/coupon.js';
import { getAppSettings } from '../utils/settings.js';
import { isOurCloudinaryUrl } from '../config/cloudinary.js';
import { PAYMENT_STATUS } from '../constants/payment.js';

// Helper to generate a unique Transfer Reference
const generateTransferReference = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let ref = 'TRF-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
};

// ─── POST /api/v1/payments/transfer/request ──────────────────────────────────
// Student initializes a bank transfer payment request for a course.
// Returns the Transfer reference, price in MAD, and bank RIB information.
export const requestTransferPayment = async (req, res, next) => {
  try {
    const { courseId, couponCode } = req.body;
    validateRequired(req.body, ['courseId']);
    validateUUID(courseId, 'courseId');

    const userId = req.user.id;

    // Verify course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    if (course.status !== 'published') {
      return next(new AppError('This course is not available for purchase.', 400, 'BAD_REQUEST'));
    }

    // Check if user is already enrolled (either PAID, PENDING, or WAITING_VERIFICATION)
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { payment: true },
    });

    if (existingEnrollment && existingEnrollment.payment) {
      const status = existingEnrollment.payment.status;
      if (status === 'PAID') {
        return next(new AppError('You are already enrolled and have full access to this course.', 409, 'CONFLICT'));
      }
      if (status === 'PENDING' || status === 'WAITING_VERIFICATION') {
        return res.status(200).json(
          successResponse({
            message: `You already have an active payment request with status: ${status}`,
            paymentId: existingEnrollment.payment.id,
            paymentReference: existingEnrollment.payment.transactionReference,
            amount: existingEnrollment.payment.amount,
            status,
          })
        );
      }
    }

    // Resolve coupon discount (shared helper — codes are case-insensitive)
    let discountedPrice = Number(course.price);
    let coupon = null;

    if (couponCode) {
      coupon = await resolveValidCoupon(couponCode, courseId);
      discountedPrice = applyCouponDiscount(course.price, coupon.discount);
    }

    const reference = generateTransferReference();

    const result = await prisma.$transaction(async (tx) => {
      // If there was a previous REJECTED payment, we clean it up so they can retry
      if (existingEnrollment && existingEnrollment.payment?.status === 'REJECTED') {
        await tx.payment.delete({ where: { enrollmentId: existingEnrollment.id } });
        await tx.enrollment.delete({ where: { id: existingEnrollment.id } });
      }

      const newEnrollment = await tx.enrollment.create({
        data: { userId, courseId },
      });

      const newPayment = await tx.payment.create({
        data: {
          enrollmentId:         newEnrollment.id,
          amount:               discountedPrice,
          currency:             'MAD',
          provider:             'transfer',
          transactionReference: reference,
          status:               PAYMENT_STATUS.PENDING,
          couponId:             coupon?.id || null,
        },
      });

      return { enrollmentId: newEnrollment.id, payment: newPayment };
    });

    res.status(201).json(
      successResponse({
        message: 'Bank transfer payment request initialized successfully.',
        paymentId:        result.payment.id,
        paymentReference: result.payment.transactionReference,
        amount:           Number(result.payment.amount).toFixed(2),
        currency:         'MAD',
        bankInfo: {
          bankName: 'Attijariwafa Bank',
          accountName: '212Learn SARL',
          rib: process.env.BANK_RIB || '01178000011800000000123456',
          iban: process.env.BANK_IBAN || 'MA89 0117 8000 0118 0000 0000 1234 56',
          swift: process.env.BANK_SWIFT || 'CWBAMAMM',
        },
        instructions: {
          step1: 'Make a bank transfer (virement) to the account provided above.',
          step2: 'Use the payment reference: ' + result.payment.transactionReference + ' in the transfer description.',
          step3: 'Transfer amount: ' + Number(result.payment.amount).toFixed(2) + ' MAD',
          step4: 'Upload your transfer receipt (relevé de virement) and submit your RIB on your dashboard.',
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/payments/transfer/submit ───────────────────────────────────
// Student submits RIB and transfer receipt.
// Moves status from PENDING/REJECTED to WAITING_VERIFICATION.
export const submitTransferDetails = async (req, res, next) => {
  try {
    const { paymentReference, rib } = req.body;

    validateRequired(req.body, ['paymentReference', 'rib']);

    // Validate RIB format (24 digits for Morocco)
    const cleanRib = String(rib).trim().replace(/\s/g, '');
    if (!/^\d{24}$/.test(cleanRib)) {
      return next(new AppError('RIB must be exactly 24 digits.', 400, 'VALIDATION_ERROR'));
    }

    // Resolve transfer receipt image URL. A file upload yields a trusted Cloudinary
    // URL; a client-supplied transferReceiptUrl must be one of OUR Cloudinary URLs,
    // otherwise an attacker could store an arbitrary phishing link admins later click.
    let transferReceiptUrl = req.body.transferReceiptUrl || null;
    if (req.file) {
      transferReceiptUrl = req.file.path; // Cloudinary secure URL injected by multer storage
    } else if (transferReceiptUrl && !isOurCloudinaryUrl(transferReceiptUrl)) {
      return next(new AppError('transferReceiptUrl must be a file uploaded to our Cloudinary account.', 400, 'VALIDATION_ERROR'));
    }

    // Find the payment request — must belong to the authenticated student
    const payment = await prisma.payment.findFirst({
      where: {
        transactionReference: paymentReference,
        provider: 'transfer',
        enrollment: { userId: req.user.id },
      },
      include: {
        enrollment: { select: { id: true, userId: true, courseId: true } },
      },
    });

    if (!payment) {
      return next(new AppError('Payment request not found.', 404, 'NOT_FOUND'));
    }

    if (payment.status === 'PAID') {
      return next(new AppError('This payment has already been verified and completed.', 409, 'CONFLICT'));
    }

    // Auto-approve is a DEV-ONLY convenience gated solely by a server env flag and is
    // HARD-DISABLED in production. It never reads any client-supplied value (the old
    // ?demo=true query param is gone) so a student cannot self-approve their payment.
    const appSettings = await getAppSettings();
    const autoApprove =
      process.env.NODE_ENV !== 'production' &&
      (process.env.TRANSFER_AUTO_APPROVE === 'true' || appSettings.wafacashAutoApprove === true);

    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Dev auto-approve becomes PAID here, so count the coupon usage atomically too.
      if (autoApprove && payment.couponId) {
        await consumeCouponUsage(tx, payment.couponId);
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          status:             autoApprove ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.WAITING_VERIFICATION,
          rib:                cleanRib,
          transferReceiptUrl: transferReceiptUrl || payment.transferReceiptUrl,
          paidAt:             autoApprove ? new Date() : null,
          notes:              autoApprove ? 'Demo Mode Auto-Approval' : null,
        },
      });
    });

    res.status(200).json(
      successResponse({
        paymentId:          updatedPayment.id,
        status:             updatedPayment.status,
        message: autoApprove
          ? 'DEMO MODE: Bank transfer validated instantly! Course access unlocked.'
          : 'RIB and transfer receipt submitted. Awaiting admin manual validation.',
        rib:                cleanRib,
        transferReceiptUrl: updatedPayment.transferReceiptUrl,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/payments/transfer/pending ───────────────────────────────────
// Admin retrieves all bank transfer payments with status 'WAITING_VERIFICATION' to moderate.
export const getPendingTransfers = async (req, res, next) => {
  try {
    const { status } = req.query;

    const whereClause = {
      provider: 'transfer',
    };

    if (status === 'paid' || status === 'PAID') {
      whereClause.status = 'PAID';
    } else if (status === 'rejected' || status === 'REJECTED') {
      whereClause.status = 'REJECTED';
    } else if (status === 'pending' || status === 'PENDING' || status === 'WAITING_VERIFICATION') {
      whereClause.status = { in: ['WAITING_VERIFICATION', 'PENDING'] };
    }
    // If status is 'all' or omitted, whereClause has no status restriction -> returns all transfer payments

    const payments = await prisma.payment.findMany({
      where: whereClause,
      include: {
        enrollment: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            course: {
              select: { id: true, title: true, price: true },
            },
          },
        },
      },
      orderBy: { id: 'desc' },
      take: 200, // cap unbounded admin read
    });

    res.status(200).json(successResponse({ payments }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/payments/transfer/verify ──────────────────────────────────
// Admin approves or rejects the submitted bank transfer.
export const verifyTransferPayment = async (req, res, next) => {
  try {
    const { paymentId, action, notes } = req.body; // action: 'approve' | 'reject'

    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return next(new AppError('paymentId and action ("approve" | "reject") are required.', 400, 'VALIDATION_ERROR'));
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return next(new AppError('Payment record not found.', 404, 'NOT_FOUND'));
    }

    if (payment.provider !== 'transfer') {
      return next(new AppError('This is not a bank transfer payment.', 400, 'BAD_REQUEST'));
    }

    if (payment.status === 'PAID') {
      return next(new AppError('This payment is already approved and paid.', 409, 'CONFLICT'));
    }

    // Use transaction to prevent race conditions on payment status changes
    const updated = await prisma.$transaction(async (tx) => {
      // Lock the payment row for update
      const lockedPayment = await tx.payment.findUnique({
        where: { id: paymentId },
      });

      if (lockedPayment.status === 'PAID') {
        throw new AppError('Payment already processed by another request.', 409, 'CONFLICT');
      }

      // Count the coupon usage only on actual approval, atomically (enforces maxUsage).
      if (action === 'approve' && lockedPayment.couponId) {
        await consumeCouponUsage(tx, lockedPayment.couponId);
      }

      return await tx.payment.update({
        where: { id: paymentId },
        data: {
          status:     action === 'approve' ? PAYMENT_STATUS.PAID : PAYMENT_STATUS.REJECTED,
          paidAt:     action === 'approve' ? new Date() : null,
          verifiedBy: req.user.id,
          verifiedAt: new Date(),
          notes:      notes || null,
        },
      });
    });

    res.status(200).json(
      successResponse({
        paymentId,
        status: updated.status,
        message: action === 'approve'
          ? 'Bank transfer approved. Course access unlocked.'
          : 'Bank transfer rejected. Student invited to correct information.',
        notes:   updated.notes,
      })
    );
  } catch (error) {
    next(error);
  }
};
