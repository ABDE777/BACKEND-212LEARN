import express from 'express';
import { getPublicStats, getPublicTestimonials, getPublicInstructors, getPublicAdmins } from '../controllers/stats.controller.js';
import { publicCache } from '../middleware/cache.js';

const router = express.Router();

router.get('/', publicCache(120), getPublicStats);
router.get('/testimonials', publicCache(300), getPublicTestimonials);
router.get('/instructors', publicCache(300), getPublicInstructors);
router.get('/admins', publicCache(300), getPublicAdmins);

export default router;
