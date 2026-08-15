import { Router } from 'express';
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  getCouponUsage,
} from '../controllers/coupon.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /coupons/validate:
 *   post:
 *     summary: Validate a coupon code (optional course price preview)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code]
 *             properties:
 *               code: { type: string, example: WELCOME20 }
 *               courseId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Coupon valid — includes price preview when courseId provided
 *       400:
 *         description: Invalid or expired coupon
 */
router.post('/validate', protect, validateCoupon);

/**
 * @swagger
 * /coupons:
 *   get:
 *     summary: List all coupons (admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Paginated coupons
 *   post:
 *     summary: Create a coupon (admin global/scoped; instructor scoped to own course)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [code, discount, expirationDate]
 *             properties:
 *               code: { type: string, example: WELCOME20 }
 *               discount: { type: number, example: 20, description: Percent off (0-100) }
 *               expirationDate: { type: string, format: date-time }
 *               courseId: { type: string, format: uuid, description: Scope to a single course. Required for instructors; optional (global) for admins. }
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.get('/', protect, restrictTo('instructor', 'admin'), listCoupons);
router.post('/', protect, restrictTo('instructor', 'admin'), createCoupon);

/**
 * @swagger
 * /coupons/{id}:
 *   patch:
 *     summary: Update a coupon (admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     summary: Delete a coupon (admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.patch('/:id', protect, restrictTo('instructor', 'admin'), updateCoupon);
router.delete('/:id', protect, restrictTo('instructor', 'admin'), deleteCoupon);

/**
 * @swagger
 * /coupons/{id}/usage:
 *   get:
 *     summary: Get coupon usage details (admin)
 *     tags: [Coupons]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: List of payments that used this coupon
 */
router.get('/:id/usage', protect, restrictTo('instructor', 'admin'), getCouponUsage);

export default router;
