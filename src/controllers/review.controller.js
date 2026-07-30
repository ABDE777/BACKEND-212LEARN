import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { createNotification } from '../utils/gamification.js';
import { validateUUID, validateRequired, validateNumberRange } from '../utils/validation.js';

// ─── POST /api/v1/courses/:courseId/reviews ───────────────────────────────────
// Student submits a star rating and optional comment for a course they enrolled in.
export const submitReview = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    validateUUID(courseId, 'courseId');
    validateRequired(req.body, ['rating']);
    validateNumberRange(req.body.rating, { min: 1, max: 5 }, 'rating');

    const { rating, comment } = req.body;
    const userId = req.user.id;

    // Course must exist
    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Student must be enrolled with a PAID payment to review
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId },
      include: { payment: true }, // singular — Payment is 1:1 with Enrollment
    });

    const hasPaidEnrollment = enrollment?.payment?.status === 'PAID';
    if (!hasPaidEnrollment && req.user.role === 'student') {
      return next(new AppError('You must be enrolled in this course to leave a review.', 403, 'FORBIDDEN'));
    }

    // Prevent duplicate reviews
    const existing = await prisma.review.findFirst({ where: { userId, courseId } });
    if (existing) {
      // Update existing review instead of creating a new one
      const updated = await prisma.review.update({
        where: { id: existing.id },
        data: {
          rating,
          ...(comment !== undefined && { comment }),
        },
      });
      return res.status(200).json(successResponse({
        ...updated,
        message: 'Your review has been updated.',
      }));
    }

    // Create review
    const review = await prisma.review.create({
      data: {
        userId,
        courseId,
        rating,
        comment: comment || null,
        reviewDate: new Date(),
      },
    });

    // Notify instructor (find the lead instructor of this course)
    const courseInstructor = await prisma.courseInstructor.findFirst({
      where: { courseId, role: 'lead_instructor' },
    });
    if (courseInstructor) {
      const stars = '⭐'.repeat(rating);
      await createNotification(
        courseInstructor.userId,
        `${stars} Un étudiant a laissé un avis ${rating}/5 sur votre cours "${course.title}".`
      );
    }

    res.status(201).json(successResponse(review));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/courses/:courseId/reviews ────────────────────────────────────
// List all reviews for a course (public).
export const getCourseReviews = async (req, res, next) => {
  try {
    const courseId = req.params.courseId || req.params.id;
    validateUUID(courseId, 'courseId');

    const page  = Math.max(1, parseInt(req.query.page, 10)  || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 10);

    const course = await prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where:   { courseId },
        orderBy: { reviewDate: 'desc' },
        skip:    (page - 1) * limit,
        take:    limit,
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, avatar: true },
          },
        },
      }),
      prisma.review.count({ where: { courseId } }),
    ]);

    // Calculate average rating
    const allRatings = await prisma.review.findMany({
      where:  { courseId },
      select: { rating: true },
    });
    const averageRating = allRatings.length > 0
      ? (allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length).toFixed(1)
      : null;

    res.status(200).json(
      successResponse({
        courseId,
        averageRating: averageRating ? Number(averageRating) : null,
        totalReviews: total,
        reviews,
        page,
        totalPages: Math.ceil(total / limit),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/users/:userId/notifications ──────────────────────────────────
// Retrieve a user's notifications (with optional ?unreadOnly=true filter).
export const getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.params;
    validateUUID(userId, 'userId');

    // Only the owner or admin can view their own notifications
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(new AppError('You can only view your own notifications.', 403, 'FORBIDDEN'));
    }

    const unreadOnly = req.query.unreadOnly === 'true';

    const notifications = await prisma.notification.findMany({
      where:   { userId, ...(unreadOnly && { isRead: false }) },
      orderBy: { sentAt: 'desc' },
      take:    50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.status(200).json(successResponse({ notifications, unreadCount }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/users/:userId/notifications/read-all ──────────────────────
// Mark all notifications as read.
export const markAllNotificationsRead = async (req, res, next) => {
  try {
    const { userId } = req.params;
    validateUUID(userId, 'userId');

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(new AppError('Forbidden.', 403, 'FORBIDDEN'));
    }

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data:  { isRead: true },
    });

    res.status(200).json(successResponse({ message: 'All notifications marked as read.' }));
  } catch (error) {
    next(error);
  }
};
