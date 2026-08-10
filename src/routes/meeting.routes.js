import { Router } from 'express';
import {
  getCourseMeetings,
  getAllMeetings,
  createMeeting,
  startMeeting,
  endMeeting,
  updateMeeting,
  deleteMeeting,
  getMeetingJoinInfo,
  meetingWebhook,
} from '../controllers/meeting.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// All meeting routes require authentication except webhook
router.use(protect);

// ── Course Meetings ────────────────────────────────────────────────────────

/**
 * @swagger
 * /courses/{courseId}/meetings:
 *   get:
 *     summary: Get all meetings for a course
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of meetings
 *       403:
 *         description: Not authorized to view meetings
 */
router.get('/courses/:courseId/meetings', getCourseMeetings);

/**
 * @swagger
 * /admin/meetings:
 *   get:
 *     summary: Get all meetings (admin only)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all meetings with course info
 *       403:
 *         description: Not authorized (admin only)
 */
router.get('/admin/meetings', restrictTo('admin'), getAllMeetings);

/**
 * @swagger
 * /courses/{courseId}/meetings:
 *   post:
 *     summary: Create a new meeting for a course (instructor/admin only)
 *     tags: [Meetings]
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
 *             type: object
 *             required: [title, meetingDate]
 *             properties:
 *               title:
 *                 type: string
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *               durationMinutes:
 *                 type: number
 *                 default: 60
 *     responses:
 *       201:
 *         description: Meeting created successfully
 *       403:
 *         description: Not authorized to create meetings
 */
router.post('/courses/:courseId/meetings', restrictTo('instructor', 'admin'), createMeeting);

// ── Meeting Management ───────────────────────────────────────────────────────

/**
 * @swagger
 * /meetings/{id}/start:
 *   patch:
 *     summary: Start a meeting (instructor/admin only)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Meeting started successfully
 *       403:
 *         description: Not authorized to start meetings
 */
router.patch('/meetings/:id/start', restrictTo('instructor', 'admin'), startMeeting);

/**
 * @swagger
 * /meetings/{id}/end:
 *   patch:
 *     summary: End a meeting (instructor/admin only)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Meeting ended successfully
 *       403:
 *         description: Not authorized to end meetings
 */
router.patch('/meetings/:id/end', restrictTo('instructor', 'admin'), endMeeting);

/**
 * @swagger
 * /meetings/{id}:
 *   patch:
 *     summary: Update a meeting (instructor/admin only)
 *     tags: [Meetings]
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
 *             type: object
 *             properties:
 *               title:
 *                 type: string
 *               meetingDate:
 *                 type: string
 *                 format: date-time
 *               meetingUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Meeting updated successfully
 *       403:
 *         description: Not authorized to update meetings
 */
router.patch('/meetings/:id', restrictTo('instructor', 'admin'), updateMeeting);

/**
 * @swagger
 * /meetings/{id}:
 *   delete:
 *     summary: Delete a meeting (instructor/admin only)
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Meeting deleted successfully
 *       403:
 *         description: Not authorized to delete meetings
 */
router.delete('/meetings/:id', restrictTo('instructor', 'admin'), deleteMeeting);

/**
 * @swagger
 * /meetings/{id}/join:
 *   get:
 *     summary: Generate JaaS JWT for meeting access
 *     tags: [Meetings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: JaaS JWT generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     jwt:
 *                       type: string
 *                     domain:
 *                       type: string
 *                     roomName:
 *                       type: string
 *                     moderator:
 *                       type: boolean
 *                     meeting:
 *                       type: object
 *       400:
 *         description: Meeting has already ended
 *       403:
 *         description: Not authorized to access this meeting
 *       404:
 *         description: Meeting not found
 */
router.get('/meetings/:id/join', getMeetingJoinInfo);

// Webhook route (no auth required for Jitsi webhook)
router.post('/meetings/webhook', meetingWebhook);

export default router;
