import crypto from 'crypto';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import {
  successResponse,
  paginationMeta,
  parsePagination,
} from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';
import { PAYMENT_STATUS } from '../constants/payment.js';

// GET /api/v1/enrollments?page=1&limit=20
export const getMyCourses = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = { userId: req.user.id };

    const [total, enrollments] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        include: {
          course: {
            include: {
              category: { select: { id: true, name: true } },
              _count: { select: { sections: true, reviews: true } },
            },
          },
          payment: {
            select: {
              id: true,
              status: true,
              amount: true,
              currency: true,
              provider: true,
              transactionReference: true,
              mtcn: true,
              receiptUrl: true,
              paidAt: true,
              notes: true,
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    // Attach real per-course progress: completed lessons / total lessons in the
    // course. Computed at read time (no stored progress column).
    const enrollmentsWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const courseId = enrollment.courseId;
        const [totalLessons, completedLessons] = await Promise.all([
          prisma.lesson.count({ where: { section: { courseId } } }),
          prisma.lessonProgress.count({
            where: { userId: req.user.id, completed: true, lesson: { section: { courseId } } },
          }),
        ]);
        const progress = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;
        return { ...enrollment, totalLessons, completedLessons, progress };
      })
    );

    res
      .status(200)
      .json(
        successResponse({ enrollments: enrollmentsWithProgress }, paginationMeta(total, page, limit))
      );
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/enrollments
export const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.body;

    validateRequired(req.body, ['courseId']);
    validateUUID(courseId, 'courseId');

    // Verify course exists and is published
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, deletedAt: true, price: true },
    });

    if (!course || course.deletedAt || course.status !== 'published') {
      return next(
        new AppError(
          'Course not found or not available for enrollment.',
          404,
          'NOT_FOUND'
        )
      );
    }

    // Paid courses must go through the payment flow, which creates the enrollment
    // AND its payment together. Enrolling directly here would create a paymentless
    // enrollment that (a) is still blocked by the paywall, (b) inflates the public
    // enrollment count, and (c) strands the real checkout — the later
    // /payments/*/request hits the unique (userId,courseId) constraint (P2002).
    if (Number(course.price) > 0) {
      return next(
        new AppError(
          'This is a paid course. Start a payment via /payments/wafacash/request or /payments/transfer/request.',
          400,
          'PAYMENT_REQUIRED'
        )
      );
    }

    // Idempotency: return existing enrollment instead of throwing
    const existing = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId } },
      include: { course: { select: { id: true, title: true, price: true } } },
    });

    if (existing) {
      return next(
        new AppError(
          'Already enrolled in this course.',
          409,
          'ALREADY_ENROLLED'
        )
      );
    }

    // Free course: create the enrollment together with a settled zero-amount
    // payment, so the paywall (which requires payment.status === 'PAID') grants
    // access. Paid courses never reach this branch.
    const reference = `FREE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const enrollment = await prisma.enrollment.create({
      data: {
        userId: req.user.id,
        courseId,
        payment: {
          create: {
            amount: 0,
            currency: 'MAD',
            provider: 'free',
            transactionReference: reference,
            status: PAYMENT_STATUS.PAID,
            paidAt: new Date(),
          },
        },
      },
      include: {
        course: { select: { id: true, title: true, price: true } },
        payment: { select: { id: true, status: true, amount: true, provider: true } },
      },
    });

    res.status(201).json(successResponse({ enrollment }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/enrollments/:id  → unenroll, 204
export const unenroll = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'enrollmentId');

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: req.params.id },
    });

    if (!enrollment) {
      return next(new AppError('Enrollment not found.', 404, 'NOT_FOUND'));
    }

    if (enrollment.userId !== req.user.id) {
      return next(
        new AppError(
          'You are not authorized to cancel this enrollment.',
          403,
          'FORBIDDEN'
        )
      );
    }

    await prisma.enrollment.delete({ where: { id: req.params.id } });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
