import express from 'express';
import { getPublicStats, getPublicTestimonials } from '../controllers/stats.controller.js';

const router = express.Router();

router.get('/', getPublicStats);
router.get('/testimonials', getPublicTestimonials);

export default router;
