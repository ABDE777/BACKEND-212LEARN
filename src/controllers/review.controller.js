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
    const enrollment = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
      include: { payment: true },
    });

    const hasPaidEnrollment = enrollment?.payment?.status === 'PAID';
    if (!hasPaidEnrollment && req.user.role === 'student') {
      return next(new AppError('You must be enrolled in this course to leave a review.', 403, 'FORBIDDEN'));
    }

    const existingReview = await prisma.review.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });

    const review = await prisma.review.upsert({
      where: { userId_courseId: { userId, courseId } },
      update: {
        rating,
        ...(comment !== undefined && { comment }),
        reviewDate: new Date(),
      },
      create: {
        userId,
        courseId,
        rating,
        comment: comment || null,
        reviewDate: new Date(),
      },
    });

    // Notify instructor only on first review
    if (!existingReview) {
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
    }

    res.status(existingReview ? 200 : 201).json(successResponse(review));
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

    const [reviews, total, ratingAgg] = await Promise.all([
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
      prisma.review.aggregate({
        where: { courseId },
        _avg: { rating: true },
      }),
    ]);

    const averageRating = ratingAgg._avg.rating != null
      ? Number(Number(ratingAgg._avg.rating).toFixed(1))
      : null;

    res.status(200).json(
      successResponse({
        courseId,
        averageRating,
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

// ─── PATCH /api/v1/users/:userId/notifications/:notificationId ────────────────
// Mark a single notification as read (owner or admin).
export const markNotificationRead = async (req, res, next) => {
  try {
    const { userId, notificationId } = req.params;
    validateUUID(userId, 'userId');
    validateUUID(notificationId, 'notificationId');

    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(new AppError('Forbidden.', 403, 'FORBIDDEN'));
    }

    // The notification must belong to this user.
    const notification = await prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!notification) {
      return next(new AppError('Notification not found.', 404, 'NOT_FOUND'));
    }

    const updated = await prisma.notification.update({
      where: { id: notificationId },
      data:  { isRead: true },
    });

    res.status(200).json(successResponse({ notification: updated }));
  } catch (error) {
    next(error);
  }
};
