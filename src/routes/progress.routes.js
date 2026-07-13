import { Router } from 'express';
import {
  getQuizzesByCourse,
  logProgress,
  getAchievements,
} from '../controllers/progress.controller.js';
import { protect } from '../middleware/auth.js';
import { optionalProtect, checkEnrollment } from '../middleware/enrollment.js';

const router = Router();

// ─── Quizzes ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/quizzes:
 *   get:
 *     summary: List all quizzes for a course — grouped by section and lesson
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns a flat list of all quizzes in a course, each enriched with:
 *       - `questionCount` — how many questions the quiz has
 *       - `lessonTitle`, `sectionTitle` — for navigation context
 *       - `lastAttempt` — the requesting student's most recent attempt score (if any)
 *
 *       Used by the **Quiz Player** page (`/learn/:courseId/quiz/:quizId`).
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of quizzes with metadata
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Course not found
 */
router.get('/courses/:courseId/quizzes', optionalProtect, getQuizzesByCourse);

// ─── Lesson Progress ──────────────────────────────────────────────────────────

/**
 * @swagger
 * /lessons/{lessonId}/progress:
 *   post:
 *     summary: Log or update a student's progress on a lesson (student only)
 *     tags: [Progress]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Upserts the `LessonProgress` record for the authenticated student.
 *       Sends periodic updates from the **Classroom Player** (`/learn/:courseId/lesson/:lessonId`).
 *       Call this whenever the student pauses, seeks, or completes a video lesson.
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               completed:
 *                 type: boolean
 *                 description: Mark the lesson as fully completed
 *                 example: true
 *               videoPosition:
 *                 type: integer
 *                 description: Current video playback position in seconds
 *                 example: 420
 *               timeSpent:
 *                 type: integer
 *                 description: Cumulative seconds spent watching this lesson
 *                 example: 600
 *     responses:
 *       200:
 *         description: Progress logged/updated
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Not enrolled in this course
 *       404:
 *         description: Lesson not found
 */
router.post('/lessons/:lessonId/progress', protect, checkEnrollment, logProgress);

// ─── Achievements ─────────────────────────────────────────────────────────────

/**
 * @swagger
 * /users/{userId}/achievements:
 *   get:
 *     summary: Get a student's gamification achievements — badges, certificates & stats
 *     tags: [Progress]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       Returns the full achievement panel for the **Student Dashboard** (`/student/dashboard`).
 *       Includes:
 *       - **stats** — completion rate, total enrollments, time spent, badges & certificates earned
 *       - **badges** — list of earned badge definitions with metadata
 *       - **certificates** — list of completed course certificates
 *       - **quizAttempts** — top 10 quiz attempt scores
 *
 *       Only the owner (student themselves) or an Admin can access another user's achievements.
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Achievement data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       403:
 *         description: Forbidden — can only view your own achievements
 *       404:
 *         description: User not found
 */
router.get('/users/:userId/achievements', protect, getAchievements);

export default router;
