import { Router } from 'express';
import {
  requestPackPurchase,
  submitPackPayment,
  getMyPackPurchases,
  getPendingPackPurchases,
  verifyPackPurchase,
} from '../controllers/packPurchase.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { uploadReceipt } from '../config/cloudinary.js';

const router = Router();

/**
 * @swagger
 * /pack-payments/request:
 *   post:
 *     summary: Initiate a pack purchase (student) — locks launch/normal price
 *     tags: [Pack Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [packId]
 *             properties:
 *               packId: { type: string, format: uuid }
 *               provider: { type: string, enum: [wafacash, transfer] }
 *     responses:
 *       201: { description: Purchase initialized (PENDING) with locked price }
 */
router.post('/request', protect, restrictTo('student'), requestPackPurchase);

/**
 * @swagger
 * /pack-payments/submit:
 *   post:
 *     summary: Submit proof of payment for a pack (student)
 *     tags: [Pack Payments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Awaiting admin validation (WAITING_VERIFICATION) }
 */
router.post('/submit', protect, restrictTo('student'), uploadReceipt.single('receipt'), submitPackPayment);

/**
 * @swagger
 * /pack-payments/mine:
 *   get:
 *     summary: List my pack purchases (student)
 *     tags: [Pack Payments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Purchases }
 */
router.get('/mine', protect, getMyPackPurchases);

/**
 * @swagger
 * /pack-payments/pending:
 *   get:
 *     summary: List pack purchases awaiting validation (admin)
 *     tags: [Pack Payments]
 *     security: [{ bearerAuth: [] }]
 *     responses:
 *       200: { description: Purchases }
 * /pack-payments/verify:
 *   patch:
 *     summary: Approve or reject a pack purchase (admin)
 *     tags: [Pack Payments]
 *     security: [{ bearerAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [purchaseId, action]
 *             properties:
 *               purchaseId: { type: string, format: uuid }
 *               action: { type: string, enum: [approve, reject] }
 *               notes: { type: string }
 *     responses:
 *       200: { description: Verified — access granted + revenue shares written on approve }
 */
router.get('/pending', protect, restrictTo('admin'), getPendingPackPurchases);
router.patch('/verify', protect, restrictTo('admin'), verifyPackPurchase);

export default router;
