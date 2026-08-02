import { Router } from 'express';
import {
  listCoupons,
  createCoupon,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
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
 *     summary: Create a coupon (admin)
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
 *     responses:
 *       201:
 *         description: Coupon created
 */
router.get('/', protect, restrictTo('admin'), listCoupons);
router.post('/', protect, restrictTo('admin'), createCoupon);

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
router.patch('/:id', protect, restrictTo('admin'), updateCoupon);
router.delete('/:id', protect, restrictTo('admin'), deleteCoupon);

export default router;
