import express from 'express';
import { protect } from '../middleware/auth.js';
import {
  getGroupMessages,
  sendGroupMessage,
  deleteGroupMessage,
} from '../controllers/groupChat.controller.js';

const router = express.Router({ mergeParams: true });

// Protect all group chat endpoints (User must be logged in)
router.use(protect);

/**
 * @route   GET /api/v1/groups/:groupId/messages
 * @desc    Get group chat history
 * @access  Private (Group members, instructor, admin)
 */
router.get('/:groupId/messages', getGroupMessages);

/**
 * @route   POST /api/v1/groups/:groupId/messages
 * @desc    Send a text or media message into group chat (Scanned by Groq AI Moderation)
 * @access  Private (Group members, instructor, admin)
 */
router.post('/:groupId/messages', sendGroupMessage);

/**
 * @route   DELETE /api/v1/groups/:groupId/messages/:messageId
 * @desc    Delete a message
 * @access  Private (Sender, instructor, admin)
 */
router.delete('/:groupId/messages/:messageId', deleteGroupMessage);

export default router;
