import { Router } from 'express';
import { getMyCourses, enrollInCourse } from '../controllers/enrollment.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

/**
 * @swagger
 * /enrollments/my-courses:
 *   get:
 *     summary: Get all courses I am enrolled in
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of enrollments with course details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     enrollments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Enrollment'
 *       401:
 *         description: Unauthorized
 */
router.get('/my-courses', getMyCourses);

/**
 * @swagger
 * /enrollments:
 *   post:
 *     summary: Enroll in a course
 *     tags: [Enrollments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the course to enroll in
 *     responses:
 *       201:
 *         description: Successfully enrolled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     enrollment:
 *                       $ref: '#/components/schemas/Enrollment'
 *       409:
 *         description: Already enrolled in this course
 *       401:
 *         description: Unauthorized
 */
router.post('/', enrollInCourse);

export default router;
