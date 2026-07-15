import { Router } from 'express';
import {
  getRevenueAnalytics,
  getStudentAnalytics,
  getCompletionAnalytics,
  createMeeting,
  getCourseMeetings,
} from '../controllers/analytics.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// All analytics routes require authentication
router.use(protect);

// ── Instructor / Admin Analytics ─────────────────────────────────────────────

/**
 * @swagger
 * /instructor/analytics/revenue:
 *   get:
 *     summary: Monthly revenue trends for the instructor's courses (admin sees global)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Revenue breakdown — totalRevenue, monthly[], topCourses[]
 *       403:
 *         description: Instructor or admin required
 */
router.get(
  '/instructor/analytics/revenue',
  restrictTo('instructor', 'admin'),
  getRevenueAnalytics
);

/**
 * @swagger
 * /instructor/analytics/students:
 *   get:
 *     summary: Active student metrics per course (admin sees global)
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Student count per course with recent enrollments
 */
router.get(
  '/instructor/analytics/students',
  restrictTo('instructor', 'admin'),
  getStudentAnalytics
);

/**
 * @swagger
 * /instructor/analytics/completion:
 *   get:
 *     summary: Course completion rates — % of enrolled students who finished all lessons
 *     tags: [Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Completion rate per course with averageProgress
 */
router.get(
  '/instructor/analytics/completion',
  restrictTo('instructor', 'admin'),
  getCompletionAnalytics
);

// ── Course Meetings (Live Sessions) ──────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/meetings:
 *   get:
 *     summary: List all scheduled meetings (upcoming & past) for a course
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Upcoming and past meetings with total count
 */
router.get('/courses/:courseId/meetings', getCourseMeetings);

/**
 * @swagger
 * /courses/{courseId}/meetings:
 *   post:
 *     summary: Create a live session meeting for a course (instructor / admin)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       - Notifies all enrolled (PAID) students with the session details.
 *       - `meetingDate` must be a valid ISO 8601 date string.
 *       - `meetingUrl` must be a valid URL (e.g., Zoom or Google Meet).
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
 *             required: [title, meetingUrl, meetingDate]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "Q&A Session: React Hooks Deep Dive"
 *               meetingUrl:
 *                 type: string
 *                 example: "https://zoom.us/j/123456789"
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-08-01T18:00:00.000Z"
 *     responses:
 *       201:
 *         description: Meeting created and students notified
 *       400:
 *         description: Validation error — missing fields or invalid URL/date
 *       403:
 *         description: Not an instructor of this course
 */
router.post(
  '/courses/:courseId/meetings',
  restrictTo('instructor', 'admin'),
  createMeeting
);

export default router;
