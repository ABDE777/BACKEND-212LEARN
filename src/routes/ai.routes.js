import { Router } from 'express';
import { getAiOverview } from '../controllers/ai.controller.js';

const router = Router();

/**
 * @swagger
 * /ai/overview:
 *   get:
 *     summary: Machine-readable platform overview for AI agents & answer engines
 *     description: Public, cached JSON describing 212Learn — positioning, topics, categories and featured published courses. Intended for GEO/AEO/AI-SEO consumption.
 *     tags: [AI]
 *     responses:
 *       200:
 *         description: Platform overview
 */
router.get('/overview', getAiOverview);

export default router;
