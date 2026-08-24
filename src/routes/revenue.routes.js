import { Router } from 'express';
import {
  getInstructorEarnings,
  getRevenueShares,
  markSharesPaidOut,
} from '../controllers/revenue.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /instructor/earnings:
 *   get:
 *     summary: Logged-in instructor's pack revenue (admins may pass ?instructorId)
 *     tags: [Revenue]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Summary + per-sale revenue shares }
 */
router.get('/instructor/earnings', protect, restrictTo('instructor', 'admin'), getInstructorEarnings);

/**
 * @swagger
 * /admin/revenue-shares:
 *   get:
 *     summary: Payout report — all revenue shares grouped per instructor (admin)
 *     tags: [Revenue]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Totals, per-instructor summaries, and raw shares }
 * /admin/revenue-shares/payout:
 *   patch:
 *     summary: Mark shares as paid out (admin manual accounting)
 *     tags: [Revenue]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shareIds: { type: array, items: { type: string, format: uuid } }
 *               instructorId: { type: string, format: uuid }
 *     responses:
 *       200: { description: Number of shares marked paid_out }
 */
router.get('/admin/revenue-shares', protect, restrictTo('admin'), getRevenueShares);
router.patch('/admin/revenue-shares/payout', protect, restrictTo('admin'), markSharesPaidOut);

export default router;
