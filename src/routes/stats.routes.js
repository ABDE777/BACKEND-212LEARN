import express from 'express';
import { getPublicStats, getPublicTestimonials, getPublicInstructors, getPublicAdmins } from '../controllers/stats.controller.js';

const router = express.Router();

router.get('/', getPublicStats);
router.get('/testimonials', getPublicTestimonials);
router.get('/instructors', getPublicInstructors);
router.get('/admins', getPublicAdmins);

export default router;
