import { Router } from 'express';
import {
  getRevenueAnalytics,
  getStudentAnalytics,
  getCompletionAnalytics,
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

// Note: Meeting routes are handled by meeting.routes.js to avoid conflicts

export default router;
