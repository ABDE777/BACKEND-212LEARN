import { Router } from 'express';
import {
  createAssignment,
  getAssignments,
  submitWork,
  getSubmissions,
  gradeSubmission,
} from '../controllers/assignment.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = Router();

// ─── Assignments ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /lessons/{lessonId}/assignments:
 *   post:
 *     summary: Create an assignment for a lesson (instructor / admin)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
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
 *             $ref: '#/components/schemas/AssignmentInput'
 *     responses:
 *       201:
 *         description: Assignment created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Lesson not found
 *   get:
 *     summary: List assignments for a lesson (authenticated users)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of assignments
 *       404:
 *         description: Lesson not found
 */
router.post('/lessons/:lessonId/assignments', protect, restrictTo('instructor', 'admin'), createAssignment);
router.get('/lessons/:lessonId/assignments',  protect, getAssignments);

// ─── Submissions ──────────────────────────────────────────────────────────────

/**
 * @swagger
 * /assignments/{assignmentId}/submissions:
 *   post:
 *     summary: Submit work for an assignment (student)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Upload a file (PDF, ZIP, image — max 200 MB)
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               fileUrl:
 *                 type: string
 *                 format: uri
 *                 description: Alternatively provide an already-hosted URL
 *     responses:
 *       201:
 *         description: Submission created
 *       400:
 *         description: No file provided or deadline passed
 *       409:
 *         description: Already submitted
 *   get:
 *     summary: List all submissions for an assignment (instructor / admin)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: assignmentId
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
 *         description: Paginated submission list
 *       404:
 *         description: Assignment not found
 */
router.post(
  '/assignments/:assignmentId/submissions',
  protect,
  restrictTo('student'),
  upload.single('file'),
  submitWork
);
router.get(
  '/assignments/:assignmentId/submissions',
  protect,
  restrictTo('instructor', 'admin'),
  getSubmissions
);

// ─── Grading ─────────────────────────────────────────────────────────────────

/**
 * @swagger
 * /submissions/{id}/grade:
 *   patch:
 *     summary: Grade a student submission (instructor / admin)
 *     tags: [Assignments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/GradeInput'
 *     responses:
 *       200:
 *         description: Submission graded
 *       400:
 *         description: Invalid grade value
 *       404:
 *         description: Submission not found
 */
router.patch('/submissions/:id/grade', protect, restrictTo('instructor', 'admin'), gradeSubmission);

export default router;
