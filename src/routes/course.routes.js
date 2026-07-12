import { Router } from 'express';
import {
  getAllCourses,
  getCourse,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  publishCourse,
} from '../controllers/course.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /courses/search:
 *   get:
 *     summary: Full-text search across course titles and descriptions
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema: { type: string }
 *         description: Minimum 2 characters
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Matching courses
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       400:
 *         description: Query too short
 */
router.get('/search', searchCourses);

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
router.get('/', getAllCourses);

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
router.get('/:id', getCourse);

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
 *             $ref: '#/components/schemas/CreateCourseInput'
 *     responses:
 *       200:
 *         description: Course updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Course not found
 */
router.patch('/:id', restrictTo('instructor', 'admin'), updateCourse);

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

export default router;
