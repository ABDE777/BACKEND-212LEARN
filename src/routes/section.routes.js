import { Router } from 'express';
import {
  getCurriculum,
  createSection,
  updateSection,
  deleteSection,
} from '../controllers/section.controller.js';
import { createLesson, updateLesson, deleteLesson } from '../controllers/lesson.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// ─── Curriculum ───────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/curriculum:
 *   get:
 *     summary: Get the full section → lesson curriculum tree for a course
 *     tags: [Curriculum]
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Curriculum tree returned
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: Course not found or not published
 */
router.get('/courses/:courseId/curriculum', getCurriculum);

// ─── Sections ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/sections:
 *   post:
 *     summary: Add a section to a course (instructor / admin)
 *     tags: [Curriculum]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/SectionInput'
 *     responses:
 *       201:
 *         description: Section created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course not found
 */
router.post('/courses/:courseId/sections', protect, restrictTo('instructor', 'admin'), createSection);

/**
 * @swagger
 * /sections/{id}:
 *   patch:
 *     summary: Update a section title or position (instructor / admin)
 *     tags: [Curriculum]
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
 *             $ref: '#/components/schemas/SectionInput'
 *     responses:
 *       200:
 *         description: Section updated
 *       404:
 *         description: Section not found
 *   delete:
 *     summary: Delete a section and all its lessons (instructor / admin)
 *     tags: [Curriculum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Section deleted — no content
 *       404:
 *         description: Section not found
 */
router.patch('/sections/:id',  protect, restrictTo('instructor', 'admin'), updateSection);
router.delete('/sections/:id', protect, restrictTo('instructor', 'admin'), deleteSection);

// ─── Lessons ──────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /sections/{sectionId}/lessons:
 *   post:
 *     summary: Add a lesson to a section (instructor / admin)
 *     tags: [Curriculum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: sectionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LessonInput'
 *     responses:
 *       201:
 *         description: Lesson created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Section not found
 */
router.post('/sections/:sectionId/lessons', protect, restrictTo('instructor', 'admin'), createLesson);

/**
 * @swagger
 * /lessons/{id}:
 *   patch:
 *     summary: Update a lesson title or position (instructor / admin)
 *     tags: [Curriculum]
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
 *             $ref: '#/components/schemas/LessonInput'
 *     responses:
 *       200:
 *         description: Lesson updated
 *       404:
 *         description: Lesson not found
 *   delete:
 *     summary: Delete a lesson and all its resources (instructor / admin)
 *     tags: [Curriculum]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Lesson deleted — no content
 *       404:
 *         description: Lesson not found
 */
router.patch('/lessons/:id',  protect, restrictTo('instructor', 'admin'), updateLesson);
router.delete('/lessons/:id', protect, restrictTo('instructor', 'admin'), deleteLesson);

export default router;
