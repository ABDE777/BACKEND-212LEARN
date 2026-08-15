import { Router } from 'express';
import { getMyCourses, enrollInCourse, unenroll } from '../controllers/enrollment.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect);

/**
 * @swagger
 * /enrollments:
 *   get:
 *     summary: List my enrollments with pagination
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of enrollments
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/', getMyCourses);

/**
 * @swagger
 * /enrollments:
 *   post:
 *     summary: Enroll in a published course (learners only)
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/EnrollInput'
 *     responses:
 *       201:
 *         description: Enrolled successfully
 *       400:
 *         description: Missing courseId
 *       403:
 *         description: Admins and instructors cannot enroll in courses
 *       404:
 *         description: Course not found or not published
 *       409:
 *         description: Already enrolled in this course
 *       401:
 *         description: Unauthorized
 */
// Only learners may enroll — admins and instructors run/teach the platform.
// (Paid courses already enforce this on /payments/*/request.)
router.post('/', restrictTo('student', 'employee'), enrollInCourse);

/**
 * @swagger
 * /enrollments/{id}:
 *   delete:
 *     summary: Unenroll from a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *         description: The enrollment ID
 *     responses:
 *       204:
 *         description: Unenrolled — no content
 *       403:
 *         description: Not your enrollment
 *       404:
 *         description: Enrollment not found
 */
router.delete('/:id', unenroll);

export default router;
