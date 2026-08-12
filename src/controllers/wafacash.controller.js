import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';
import { resolveValidCoupon, applyCouponDiscount, consumeCouponUsage } from '../utils/coupon.js';
import { isOurCloudinaryUrl } from '../config/cloudinary.js';
import crypto from 'crypto';

// ─── Webhook Signature Verification ─────────────────────────────────────────────
/**
 * Verify webhook signature to prevent payment fraud.
 * Uses HMAC-SHA256 with a shared secret key.
 */
const verifyWebhookSignature = (payload, signature, secret) => {
  if (!signature || !secret) {
    return false;
  }

  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(JSON.stringify(payload))
    .digest('hex');

  // Use timing-safe comparison to prevent timing attacks. Guard the lengths first
  // because timingSafeEqual throws on unequal-length buffers (which would surface
  // as a 500 instead of a clean rejection).
  const sigBuf = Buffer.from(String(signature));
  const expBuf = Buffer.from(expectedSignature);
  return sigBuf.length === expBuf.length && crypto.timingSafeEqual(sigBuf, expBuf);
};

// Helper to generate a unique Wafacash Reference
const generateWafacashReference = () => {
  const chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let ref = 'WFC-';
  for (let i = 0; i < 8; i++) {
    ref += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return ref;
};

// ─── POST /api/v1/payments/wafacash/request ──────────────────────────────────
// Student initializes a cash payment request for a course.
// Returns the Wafacash reference, price in MAD, and instructions.
export const requestWafacashPayment = async (req, res, next) => {
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
      coupon = await resolveValidCoupon(couponCode);
      discountedPrice = applyCouponDiscount(course.price, coupon.discount);
    }

    const reference = generateWafacashReference();

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
          provider:             'wafacash',
          transactionReference: reference,
          status:               'PENDING',
          couponId:             coupon?.id || null,
        },
      });

      return { enrollmentId: newEnrollment.id, payment: newPayment };
    });

    res.status(201).json(
      successResponse({
        message: 'Wafacash payment request initialized successfully.',
        paymentId:        result.payment.id,
        paymentReference: result.payment.transactionReference,
        amount:           Number(result.payment.amount).toFixed(2),
        currency:         'MAD',
        instructions: {
          step1: 'Visit your nearest Wafacash agency in Morocco.',
          step2: 'Provide them with the payment reference: ' + result.payment.transactionReference,
          step3: 'Pay the cash amount: ' + Number(result.payment.amount).toFixed(2) + ' MAD',
          step4: 'Upload your receipt picture and submit the 10-digit MTCN code on your dashboard.',
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/payments/wafacash/submit ───────────────────────────────────
// Student submits receipt photo + MTCN code.
// Moves status from PENDING/REJECTED to WAITING_VERIFICATION.
export const submitWafacashTransfer = async (req, res, next) => {
  try {
    const { paymentReference, mtcn } = req.body;

    validateRequired(req.body, ['paymentReference', 'mtcn']);

    const cleanMtcn = String(mtcn).trim();
    if (!/^\d{10}$/.test(cleanMtcn)) {
      return next(new AppError('MTCN transfer code must be exactly 10 digits.', 400, 'VALIDATION_ERROR'));
    }

    // Resolve receipt image URL. A file upload yields a trusted Cloudinary URL;
    // a client-supplied receiptUrl must be one of OUR Cloudinary URLs, otherwise an
    // attacker could store an arbitrary phishing link that admins later click.
    let receiptUrl = req.body.receiptUrl || null;
    if (req.file) {
      receiptUrl = req.file.path; // Cloudinary secure URL injected by multer storage
    } else if (receiptUrl && !isOurCloudinaryUrl(receiptUrl)) {
      return next(new AppError('receiptUrl must be a file uploaded to our Cloudinary account.', 400, 'VALIDATION_ERROR'));
    }

    // Find the payment request — must belong to the authenticated student
    const payment = await prisma.payment.findFirst({
      where: {
        transactionReference: paymentReference,
        provider: 'wafacash',
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
    const autoApprove =
      process.env.NODE_ENV !== 'production' &&
      process.env.WAFACASH_AUTO_APPROVE === 'true';

    const updatedPayment = await prisma.$transaction(async (tx) => {
      // Dev auto-approve becomes PAID here, so count the coupon usage atomically too.
      if (autoApprove && payment.couponId) {
        await consumeCouponUsage(tx, payment.couponId);
      }
      return tx.payment.update({
        where: { id: payment.id },
        data: {
          status:     autoApprove ? 'PAID' : 'WAITING_VERIFICATION',
          mtcn:       cleanMtcn,
          receiptUrl: receiptUrl || payment.receiptUrl,
          paidAt:     autoApprove ? new Date() : null,
          notes:      autoApprove ? 'Demo Mode Auto-Approval' : null,
        },
      });
    });

    res.status(200).json(
      successResponse({
        paymentId:        updatedPayment.id,
        status:           updatedPayment.status,
        message: autoApprove
          ? 'DEMO MODE: Wafacash payment validated instantly! Course access unlocked.'
          : 'MTCN and receipt submitted. Awaiting admin manual validation.',
        mtcn:             cleanMtcn,
        receiptUrl:       updatedPayment.receiptUrl,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/payments/wafacash/pending ───────────────────────────────────
// Admin retrieves all payments with status 'WAITING_VERIFICATION' to moderate.
export const getPendingPayments = async (req, res, next) => {
  try {
    const { status } = req.query;

    const whereClause = {
      provider: 'wafacash',
    };

    if (status === 'paid' || status === 'PAID') {
      whereClause.status = 'PAID';
    } else if (status === 'rejected' || status === 'REJECTED') {
      whereClause.status = 'REJECTED';
    } else if (status === 'pending' || status === 'PENDING' || status === 'WAITING_VERIFICATION') {
      whereClause.status = { in: ['WAITING_VERIFICATION', 'PENDING'] };
    }
    // If status is 'all' or omitted, whereClause has no status restriction -> returns all Wafacash payments

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

// ─── PATCH /api/v1/payments/wafacash/verify ──────────────────────────────────
// Admin approves or rejects the submitted Wafacash receipt.
export const verifyPayment = async (req, res, next) => {
  try {
    const { paymentId, action, notes, webhookSignature } = req.body; // action: 'approve' | 'reject'

    if (!paymentId || !['approve', 'reject'].includes(action)) {
      return next(new AppError('paymentId and action ("approve" | "reject") are required.', 400, 'VALIDATION_ERROR'));
    }

    // Verify webhook signature if provided (for automated webhooks)
    if (webhookSignature) {
      const webhookSecret = process.env.WAFACASH_WEBHOOK_SECRET;
      if (!webhookSecret) {
        return next(new AppError('Webhook secret not configured.', 500, 'SERVER_CONFIGURATION_ERROR'));
      }

      const isValid = verifyWebhookSignature(
        { paymentId, action, notes },
        webhookSignature,
        webhookSecret
      );

      if (!isValid) {
        console.error('[Wafacash] Invalid webhook signature for payment:', paymentId);
        return next(new AppError('Invalid webhook signature.', 401, 'UNAUTHORIZED'));
      }
    }

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
    });

    if (!payment) {
      return next(new AppError('Payment record not found.', 404, 'NOT_FOUND'));
    }

    if (payment.provider !== 'wafacash') {
      return next(new AppError('This is not a Wafacash payment.', 400, 'BAD_REQUEST'));
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
          status:     action === 'approve' ? 'PAID' : 'REJECTED',
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
          ? 'Payment approved. Course access unlocked.'
          : 'Payment rejected. Student invited to correct information.',
        notes:   updated.notes,
      })
    );
  } catch (error) {
    next(error);
  }
};
