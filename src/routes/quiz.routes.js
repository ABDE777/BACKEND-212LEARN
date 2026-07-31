import { Router } from 'express';
import {
  createQuiz,
  addQuestion,
  generateAIQuiz,
  getQuiz,
  updateQuiz,
  deleteQuiz,
  updateQuestion,
  deleteQuestion,
  submitAttempt,
} from '../controllers/quiz.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { checkEnrollment } from '../middleware/enrollment.js';

const router = Router();

// ─── Instructor: Manage Quizzes ───────────────────────────────────────────────

/**
 * @swagger
 * /lessons/{lessonId}/quizzes:
 *   post:
 *     summary: Create a quiz manually for a lesson (instructor only)
 *     tags: [Quizzes]
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
 *             type: object
 *             required: [title]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "useState Deep Dive Quiz"
 *     responses:
 *       201:
 *         description: Quiz created in draft status
 */
router.post('/lessons/:lessonId/quizzes', protect, restrictTo('instructor', 'admin'), createQuiz);

/**
 * @swagger
 * /lessons/{lessonId}/quizzes/generate-ai:
 *   post:
 *     summary: Generate quiz questions using AI (Gemini) — instructor only
 *     tags: [Quizzes]
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
 *             type: object
 *             required: [title, prompt]
 *             properties:
 *               title:
 *                 type: string
 *                 example: "React Hooks Quiz"
 *               prompt:
 *                 type: string
 *                 example: "Generate questions about useState, useEffect, and useContext in React"
 *               questionCount:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 20
 *                 default: 5
 *     responses:
 *       201:
 *         description: AI-generated quiz with questions created in draft status
 *       503:
 *         description: AI not configured (missing GEMINI_API_KEY)
 */
router.post('/lessons/:lessonId/quizzes/generate-ai', protect, restrictTo('instructor', 'admin'), generateAIQuiz);

// ─── Instructor: Manage Questions ─────────────────────────────────────────────

/**
 * @swagger
 * /quizzes/{quizId}/questions:
 *   post:
 *     summary: Add a single MCQ question to a quiz (instructor only)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [statement, options, correctAnswer]
 *             properties:
 *               statement:
 *                 type: string
 *                 example: "What hook is used to manage state in a functional component?"
 *               options:
 *                 type: array
 *                 items:
 *                   type: string
 *                 minItems: 2
 *                 example: ["useState", "useEffect", "useRef", "useReducer"]
 *               correctAnswer:
 *                 type: string
 *                 description: Must exactly match one of the provided options
 *                 example: "useState"
 *     responses:
 *       201:
 *         description: Question added to the quiz
 */
router.post('/quizzes/:quizId/questions', protect, restrictTo('instructor', 'admin'), addQuestion);

/**
 * @swagger
 * /quizzes/{quizId}:
 *   get:
 *     summary: Get a quiz with its questions (no correct answers revealed)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Quiz with questions (options visible, correctAnswer hidden)
 *
 *   patch:
 *     summary: Update a quiz title or change its validationStatus (instructor only)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               validationStatus:
 *                 type: string
 *                 enum: [draft, approved, rejected]
 *     responses:
 *       200:
 *         description: Quiz updated
 */
router.get('/quizzes/:quizId', protect, getQuiz);
router.patch('/quizzes/:quizId', protect, restrictTo('instructor', 'admin'), updateQuiz);
router.delete('/quizzes/:quizId', protect, restrictTo('instructor', 'admin'), deleteQuiz);

/**
 * @swagger
 * /questions/{questionId}:
 *   patch:
 *     summary: Update a question's statement, options, or correctAnswer (instructor only)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               statement: { type: string }
 *               options: { type: array, items: { type: string } }
 *               correctAnswer: { type: string }
 *     responses:
 *       200: { description: Question updated }
 *   delete:
 *     summary: Delete a question (instructor only)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: questionId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204: { description: Question deleted }
 */
router.patch('/questions/:questionId', protect, restrictTo('instructor', 'admin'), updateQuestion);
router.delete('/questions/:questionId', protect, restrictTo('instructor', 'admin'), deleteQuestion);

// ─── Student: Submit Attempt ──────────────────────────────────────────────────

/**
 * @swagger
 * /quizzes/{quizId}/attempts:
 *   post:
 *     summary: Submit quiz answers — score is calculated server-side (student only)
 *     tags: [Quizzes]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: quizId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [answers]
 *             properties:
 *               answers:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [questionId, selectedAnswer]
 *                   properties:
 *                     questionId:
 *                       type: string
 *                       format: uuid
 *                     selectedAnswer:
 *                       type: string
 *                       description: Must exactly match one of the question's options
 *                 example:
 *                   - questionId: "uuid-here"
 *                     selectedAnswer: "useState"
 *               duration:
 *                 type: integer
 *                 description: Time taken to complete the quiz in seconds
 *                 example: 180
 *     responses:
 *       201:
 *         description: Attempt recorded with score, breakdown, and pass/fail result
 */
router.post('/quizzes/:quizId/attempts', protect, restrictTo('student'), submitAttempt);

export default router;
