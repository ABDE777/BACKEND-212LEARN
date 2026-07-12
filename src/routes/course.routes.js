import { Router } from 'express';
import { getAllCourses, getCourse, createCourse, updateCourse, deleteCourse } from '../controllers/course.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /courses:
 *   get:
 *     summary: Get all published courses
 *     tags: [Courses]
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by course title
 *       - in: query
 *         name: categoryId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by category ID
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: [beginner, intermediate, advanced]
 *       - in: query
 *         name: language
 *         schema:
 *           type: string
 *         description: Filter by language (e.g. fr, en, ar)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, published, archived]
 *         description: Filter by status (admin use)
 *     responses:
 *       200:
 *         description: List of courses
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 results:
 *                   type: integer
 *                 data:
 *                   type: object
 *                   properties:
 *                     courses:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Course'
 */
router.get('/', getAllCourses);

/**
 * @swagger
 * /courses/{id}:
 *   get:
 *     summary: Get a single course by ID
 *     tags: [Courses]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Course details including sections, lessons, and reviews
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
 *                     course:
 *                       $ref: '#/components/schemas/Course'
 *       404:
 *         description: Course not found
 */
router.get('/:id', getCourse);

/**
 * @swagger
 * /courses:
 *   post:
 *     summary: Create a new course
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - requires instructor or admin role
 */
router.use(protect);
router.post('/', restrictTo('instructor', 'admin'), createCourse);

/**
 * @swagger
 * /courses/{id}:
 *   patch:
 *     summary: Update a course
 *     tags: [Courses]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
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
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       204:
 *         description: Course deleted
 *       403:
 *         description: Forbidden - requires admin role
 */
router.delete('/:id', restrictTo('admin'), deleteCourse);

export default router;
