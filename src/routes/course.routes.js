import { Router } from 'express';
import {
  getAllCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  publishCourse,
  getCourseStudents,
} from '../controllers/course.controller.js';
import { getCourseGroups } from '../controllers/group.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { publicCache } from '../middleware/cache.js';

const router = Router();

/**
 * @swagger
 * /courses:
 *   get:
 *     summary: List published courses with filters, sorting and pagination
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, title, price, duration], default: createdAt }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Filter by title keyword
 *       - in: query
 *         name: categoryId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: level
 *         schema: { type: string, enum: [beginner, intermediate, advanced] }
 *       - in: query
 *         name: language
 *         schema: { type: string, example: fr }
 *       - in: query
 *         name: status
 *         schema: { type: string, enum: [draft, published, archived] }
 *         description: Admin use only — public always sees "published"
 *     responses:
 *       200:
 *         description: Paginated course list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 */
router.get('/', publicCache(120), getAllCourses);

/**
 * @swagger
 * /courses/{id}:
 *   get:
 *     summary: Get a single course with sections, lessons and reviews
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Course details
 *       404:
 *         description: Course not found
 */
router.get('/:id', publicCache(120), getCourse);

// ── Protected routes ──────────────────────────────────────────────────────────
router.use(protect);

/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Create a new course (instructor / admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateCourseInput'
 *     responses:
 *       201:
 *         description: Course created
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — instructor or admin required
 */
router.post('/', restrictTo('instructor', 'admin'), createCourse);

/**
 * @swagger
 * /courses/{id}:
 *   patch:
 *     summary: Partially update a course (instructor / admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateCourseInput'
 *     responses:
 *       200:
 *         description: Course updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.patch('/:id', restrictTo('instructor', 'admin'), updateCourse);
router.put('/:id',   restrictTo('instructor', 'admin'), updateCourse);

/**
 * @swagger
 * /courses/{id}:
 *   delete:
 *     summary: Soft-delete a course (admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Course deleted — no content
 *       403:
 *         description: Forbidden — admin only
 */
router.delete('/:id', restrictTo('admin'), deleteCourse);

/**
 * @swagger
 * /courses/{id}/publish:
 *   post:
 *     summary: Publish a draft course (Admin only)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Course published successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Course not found
 *       409:
 *         description: Course is already published
 *       403:
 *         description: Forbidden — admin only
 */
router.post('/:id/publish', restrictTo('admin'), publishCourse);

/**
 * @swagger
 * /courses/{id}/students:
 *   get:
 *     summary: List all students enrolled in a course (instructor / admin)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated list of enrolled students
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       403:
 *         description: Forbidden — instructor or admin required
 *       404:
 *         description: Course not found
 */
router.get('/:id/students', restrictTo('instructor', 'admin'), getCourseStudents);

/**
 * @swagger
 * /courses/{courseId}/groups:
 *   get:
 *     summary: List the groups taught in a course (admin sees all; instructor sees only their own)
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Groups for the course, each with a studentCount
 */
router.get('/:courseId/groups', restrictTo('instructor', 'admin'), getCourseGroups);

export default router;
