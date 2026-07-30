import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

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
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId },
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

    // Resolve coupon discount
    let discountedPrice = Number(course.price);
    let coupon = null;

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) {
        return next(new AppError(`Coupon code "${couponCode}" is invalid.`, 400, 'VALIDATION_ERROR'));
      }
      if (new Date(coupon.expirationDate) < new Date()) {
        return next(new AppError(`Coupon code "${couponCode}" has expired.`, 400, 'VALIDATION_ERROR'));
      }
      discountedPrice = discountedPrice * (1 - Number(coupon.discount) / 100);
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
    const { demo } = req.query;

    validateRequired(req.body, ['paymentReference', 'mtcn']);

    const cleanMtcn = String(mtcn).trim();
    if (!/^\d{10}$/.test(cleanMtcn)) {
      return next(new AppError('MTCN transfer code must be exactly 10 digits.', 400, 'VALIDATION_ERROR'));
    }

    // Resolve receipt image URL
    let receiptUrl = req.body.receiptUrl || null;
    if (req.file) {
      receiptUrl = req.file.path; // Cloudinary secure URL injected by multer storage
    }

    // Find the payment request
    const payment = await prisma.payment.findFirst({
      where: {
        transactionReference: paymentReference,
        provider: 'wafacash',
      },
    });

    if (!payment) {
      return next(new AppError('Payment request not found.', 404, 'NOT_FOUND'));
    }

    if (payment.status === 'PAID') {
      return next(new AppError('This payment has already been verified and completed.', 409, 'CONFLICT'));
    }

    // Determine if auto-approve is allowed (only in dev, never in production)
    const isDev = process.env.NODE_ENV !== 'production';
    const autoApprove = isDev && (demo === 'true' || process.env.WAFACASH_AUTO_APPROVE === 'true');

    const updatedPayment = await prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:     autoApprove ? 'PAID' : 'WAITING_VERIFICATION',
        mtcn:       cleanMtcn,
        receiptUrl: receiptUrl || payment.receiptUrl,
        paidAt:     autoApprove ? new Date() : null,
        notes:      autoApprove ? 'Demo Mode Auto-Approval' : null,
      },
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
    const payments = await prisma.payment.findMany({
      where: {
        provider: 'wafacash',
        status:   'WAITING_VERIFICATION',
      },
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

    if (payment.status === 'PAID') {
      return next(new AppError('This payment is already approved and paid.', 409, 'CONFLICT'));
    }

    const updated = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status:     action === 'approve' ? 'PAID' : 'REJECTED',
        paidAt:     action === 'approve' ? new Date() : null,
        verifiedBy: req.user.id,
        verifiedAt: new Date(),
        notes:      notes || null,
      },
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
