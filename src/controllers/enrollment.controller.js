import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import {
  successResponse,
  paginationMeta,
  parsePagination,
} from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

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

    res
      .status(200)
      .json(
        successResponse({ enrollments }, paginationMeta(total, page, limit))
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
      select: { id: true, status: true, deletedAt: true },
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

    const enrollment = await prisma.enrollment.create({
      data: { userId: req.user.id, courseId },
      include: { course: { select: { id: true, title: true, price: true } } },
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
