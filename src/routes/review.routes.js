import { Router } from 'express';
import {
  submitReview,
  getCourseReviews,
  getNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../controllers/review.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// ─── Course Reviews ───────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/reviews:
 *   get:
 *     summary: List all reviews for a course — includes average rating (public)
 *     tags: [Reviews]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 10 }
 *     responses:
 *       200:
 *         description: Reviews with averageRating and pagination
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/reviews', getCourseReviews);

/**
 * @swagger
 * /courses/{courseId}/reviews:
 *   post:
 *     summary: Submit a star review for a course (enrolled student only)
 *     tags: [Reviews]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       - Requires authentication and a **PAID** enrollment in the course.
 *       - If the student already has a review for this course, it will be **updated**.
 *       - The lead instructor receives a notification when a new review is submitted.
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [rating]
 *             properties:
 *               rating:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 5
 *                 example: 5
 *               comment:
 *                 type: string
 *                 example: "Cours excellent, très bien expliqué !"
 *     responses:
 *       201:
 *         description: Review submitted
 *       200:
 *         description: Existing review updated
 *       403:
 *         description: Not enrolled with a PAID payment
 *       404:
 *         description: Course not found
 */
router.post('/courses/:courseId/reviews', protect, submitReview);

// ─── Notifications ────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/notifications:
 *   get:
 *     summary: Get a user's notifications — with unread count (owner or admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: unreadOnly
 *         schema: { type: boolean }
 *         description: Pass `true` to return only unread notifications
 *     responses:
 *       200:
 *         description: List of notifications with unreadCount
 *       403:
 *         description: Forbidden — can only view your own notifications
 */
router.get('/users/:userId/notifications', protect, getNotifications);

/**
 * @swagger
 * /users/{userId}/notifications/read-all:
 *   patch:
 *     summary: Mark all notifications as read (owner or admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       403:
 *         description: Forbidden
 */
router.patch('/users/:userId/notifications/read-all', protect, markAllNotificationsRead);

/**
 * @swagger
 * /users/{userId}/notifications/{notificationId}:
 *   patch:
 *     summary: Mark a single notification as read (owner or admin)
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       404:
 *         description: Notification not found
 */
// Must be registered AFTER /read-all so that literal path is not captured by :notificationId.
router.patch('/users/:userId/notifications/:notificationId', protect, markNotificationRead);

export default router;
