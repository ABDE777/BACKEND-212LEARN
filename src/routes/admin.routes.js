import { Router } from 'express';
import {
  getPendingKyc,
  verifyInstructor,
  refundPayment,
  getAuditLogs,
} from '../controllers/admin.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// ── Admin routes (Require admin authorization) ──────────────────────────────
router.use(protect);
router.use(restrictTo('admin'));

/**
 * @swagger
 * /admin/users/pending-kyc:
 *   get:
 *     summary: Retrieve list of instructors awaiting KYC verification (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of pending instructors
 *       403:
 *         description: Forbidden
 */
router.get('/admin/users/pending-kyc', getPendingKyc);

/**
 * @swagger
 * /admin/users/{userId}/verify:
 *   patch:
 *     summary: Verify or unverify an instructor profile (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isVerified]
 *             properties:
 *               isVerified:
 *                 type: boolean
 *               notes:
 *                 type: string
 *                 example: "Document ID looks correct."
 *     responses:
 *       200:
 *         description: KYC status updated successfully
 *       400:
 *         description: Invalid input or user role is not instructor
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:userId/verify', verifyInstructor);

/**
 * @swagger
 * /admin/payments/{paymentId}/refund:
 *   patch:
 *     summary: Mark a payment as REFUNDED, revoking student access (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "Student requested refund due to duplicate purchase."
 *     responses:
 *       200:
 *         description: Payment refunded successfully
 *       400:
 *         description: Already refunded
 *       404:
 *         description: Payment not found
 */
router.patch('/admin/payments/:paymentId/refund', refundPayment);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Retrieve administrative audit logs (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated audit logs list
 */
router.get('/admin/audit-logs', getAuditLogs);

export default router;
