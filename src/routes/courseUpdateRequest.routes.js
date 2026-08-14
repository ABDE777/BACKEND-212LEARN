import express from 'express';
const router = express.Router();
import {
  createCourseUpdateRequest,
  getAllCourseUpdateRequests,
  getInstructorUpdateRequests,
  approveCourseUpdateRequest,
  rejectCourseUpdateRequest,
} from '../controllers/courseUpdateRequest.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

// Instructor routes
router.post('/courses/:courseId/update-requests', protect, restrictTo('instructor'), createCourseUpdateRequest);
router.get('/instructor/update-requests', protect, restrictTo('instructor'), getInstructorUpdateRequests);

// Admin routes
router.get('/admin/update-requests', protect, restrictTo('admin'), getAllCourseUpdateRequests);
router.patch('/admin/update-requests/:requestId/approve', protect, restrictTo('admin'), approveCourseUpdateRequest);
router.patch('/admin/update-requests/:requestId/reject', protect, restrictTo('admin'), rejectCourseUpdateRequest);

export default router;
