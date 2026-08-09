import { Router } from 'express';
import {
  createMeeting,
  getCourseMeetings,
  startMeeting,
  endMeeting,
  meetingWebhook,
} from '../controllers/meeting.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// POST /api/v1/courses/:courseId/meetings - Create meeting (instructor/admin)
router.post(
  '/courses/:courseId/meetings',
  protect,
  restrictTo('instructor', 'admin'),
  createMeeting
);

// GET /api/v1/courses/:courseId/meetings - Get meetings
router.get('/courses/:courseId/meetings', protect, getCourseMeetings);

// PATCH /api/v1/meetings/:id/start - Start meeting (instructor/admin)
router.patch('/meetings/:id/start', protect, restrictTo('instructor', 'admin'), startMeeting);

// PATCH /api/v1/meetings/:id/end - End meeting (instructor/admin)
router.patch('/meetings/:id/end', protect, restrictTo('instructor', 'admin'), endMeeting);

// POST /api/v1/meetings/webhook - Webhook for recording completion (public, should be secured with signature)
router.post('/meetings/webhook', meetingWebhook);

export default router;
