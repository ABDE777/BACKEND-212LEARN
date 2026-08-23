import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getCourseMessages,
  sendCourseMessage,
  deleteCourseMessage,
} from '../controllers/courseChat.controller.js';

const router = express.Router({ mergeParams: true });

// All course chat endpoints require authentication.
router.use(protect);

/**
 * @route   GET /api/v1/courses/:courseId/messages
 * @desc    Get the course chat history
 * @access  Private (course instructor(s), enrolled students, admin)
 */
router.get('/:courseId/messages', getCourseMessages);

/**
 * @route   POST /api/v1/courses/:courseId/messages
 * @desc    Send a text or media message into the course chat (Groq AI moderated)
 * @access  Private (course instructor(s), enrolled students, admin)
 */
router.post('/:courseId/messages', sendCourseMessage);

/**
 * @route   DELETE /api/v1/courses/:courseId/messages/:messageId
 * @desc    Delete a course chat message
 * @access  Private (author, course instructor, admin)
 */
router.delete('/:courseId/messages/:messageId', deleteCourseMessage);

export default router;
