import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination } from '../utils/response.js';
import { logAuditEvent } from '../utils/audit.js';
import { createNotification } from '../utils/gamification.js';

// ─── GET /api/v1/admin/users/pending-kyc ─────────────────────────────────────
// Retrieve all instructors awaiting KYC verification.
export const getPendingKyc = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      role: 'instructor',
      isVerified: false,
      deletedAt: null,
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          bio: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json(
      successResponse({ users }, paginationMeta(total, page, limit))
    );
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/users/:userId/verify ────────────────────────────────
// Approve or reject/unverify an instructor's KYC status.
export const verifyInstructor = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isVerified, notes } = req.body;

    if (typeof isVerified !== 'boolean') {
      return next(new AppError('isVerified must be a boolean.', 400, 'VALIDATION_ERROR'));
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    if (targetUser.role !== 'instructor') {
      return next(new AppError('Only users with the instructor role can be KYC verified.', 400, 'BAD_REQUEST'));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isVerified },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isVerified: true },
    });

    // Write audit log
    await logAuditEvent(
      req.user.id,
      isVerified ? 'VERIFY_INSTRUCTOR' : 'UNVERIFY_INSTRUCTOR',
      'User',
      userId,
      { notes, email: targetUser.email }
    );

    // Notify the instructor
    const message = isVerified
      ? '🎉 Félicitations ! Votre profil d\'instructeur a été vérifié avec succès par l\'administration.'
      : '⚠️ Votre statut de vérification d\'instructeur a été révoqué ou rejeté par l\'administration.';
    await createNotification(userId, message);

    res.status(200).json(successResponse({ user: updatedUser, message: 'KYC verification updated.' }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/payments/:paymentId/refund ─────────────────────────
// Refund a payment. Changes status to 'REFUNDED', removing access from student.
export const refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: {
          include: {
            user: { select: { id: true, email: true, firstName: true } },
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!payment) {
      return next(new AppError('Payment record not found.', 404, 'NOT_FOUND'));
    }

    if (payment.status === 'REFUNDED') {
      return next(new AppError('This payment has already been refunded.', 400, 'BAD_REQUEST'));
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        notes: notes ? `${payment.notes || ''}\n[Refund Notes]: ${notes}` : payment.notes,
      },
    });

    // Write audit log
    await logAuditEvent(
      req.user.id,
      'REFUND_PAYMENT',
      'Payment',
      paymentId,
      {
        amount: payment.amount,
        currency: payment.currency,
        userId: payment.enrollment.userId,
        courseId: payment.enrollment.courseId,
        notes,
      }
    );

    // Notify the student
    await createNotification(
      payment.enrollment.userId,
      `💸 Votre paiement de ${payment.amount} ${payment.currency} pour le cours "${payment.enrollment.course.title}" a été remboursé.`
    );

    res.status(200).json(successResponse({ payment: updatedPayment, message: 'Payment status updated to REFUNDED.' }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/admin/audit-logs ────────────────────────────────────────────
// Fetch paginated administrative action audit logs.
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
    ]);

    res.status(200).json(
      successResponse({ logs }, paginationMeta(total, page, limit))
    );
  } catch (error) {
    next(error);
  }
};
