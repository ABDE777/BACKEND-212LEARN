import express from 'express';
import {
  submitContactMessage,
  getContactMessages,
  updateContactMessageStatus,
  deleteContactMessage,
} from '../controllers/contact.controller.js';

const router = express.Router();

/**
 * @route   POST /api/v1/contact or /api/contact
 * @desc    Submit a contact form message
 * @access  Public
 */
router.post('/', submitContactMessage);

/**
 * @route   GET /api/v1/contact or /api/contact
 * @desc    Get all contact form messages
 * @access  Public / Admin
 */
router.get('/', getContactMessages);

/**
 * @route   PATCH /api/v1/contact/:id/status or PUT /api/v1/contact/:id/status
 * @desc    Update status of a contact message
 * @access  Admin
 */
router.patch('/:id/status', updateContactMessageStatus);
router.put('/:id/status', updateContactMessageStatus);

/**
 * @route   DELETE /api/v1/contact/:id
 * @desc    Delete a contact message
 * @access  Admin
 */
router.delete('/:id', deleteContactMessage);

export default router;
