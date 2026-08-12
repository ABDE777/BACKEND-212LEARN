import { Router } from 'express';
import {
  requestWafacashPayment,
  submitWafacashTransfer,
  getPendingPayments,
  verifyPayment,
} from '../controllers/wafacash.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = Router();

// Student-facing routes
router.post('/request', protect, restrictTo('student'), requestWafacashPayment);
router.post(
  '/submit',
  protect,
  restrictTo('student'),
  upload.single('receipt'), // Cloudinary photo upload for cash receipt
  submitWafacashTransfer
);

// Admin-facing routes
router.get('/pending', protect, restrictTo('admin'), getPendingPayments);
router.patch('/verify', protect, restrictTo('admin'), verifyPayment); // PATCH for state modification

/**
 * @swagger
 * /payments/wafacash/request:
 *   post:
 *     summary: Request a Wafacash payment voucher for a course (student)
 *     tags: [Wafacash]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - courseId
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *                 example: "a345fb30-d5c7-46bc-bbbf-dd911f329cf7"
 *               couponCode:
 *                 type: string
 *                 example: "WELCOME20"
 *     responses:
 *       201:
 *         description: Request initialized - Payment state is set to PENDING
 * 
 * /payments/wafacash/submit:
 *   post:
 *     summary: Submit the Wafacash transfer receipt (upload) and MTCN code (student)
 *     tags: [Wafacash]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: demo
 *         schema:
 *           type: boolean
 *         description: Auto-approves the transaction instantly (only allowed in development)
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - paymentReference
 *               - mtcn
 *               - receipt
 *             properties:
 *               paymentReference:
 *                 type: string
 *                 description: Voucher ID returned by the request endpoint
 *                 example: "WFC-K7J9M3N2"
 *               mtcn:
 *                 type: string
 *                 pattern: "^\\d{10}$"
 *                 description: Money transfer control number (10-digit number)
 *                 example: "1234567890"
 *               receipt:
 *                 type: string
 *                 format: binary
 *                 description: Image photo of the paper receipt
 *     responses:
 *       200:
 *         description: Transfer details uploaded successfully. Status changes to WAITING_VERIFICATION.
 * 
 * /payments/wafacash/pending:
 *   get:
 *     summary: List Wafacash transactions waiting validation (admin only)
 *     tags: [Wafacash]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions in WAITING_VERIFICATION state
 * 
 * /payments/wafacash/verify:
 *   patch:
 *     summary: Approve or reject a Wafacash cash deposit (admin only)
 *     tags: [Wafacash]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentId
 *               - action
 *             properties:
 *               paymentId:
 *                 type: string
 *                 format: uuid
 *               action:
 *                 type: string
 *                 enum: [approve, reject]
 *               notes:
 *                 type: string
 *                 description: Optional notes or rejection details for the student
 *                 example: "Receipt photo is blurry. Please re-upload."
 *     responses:
 *       200:
 *         description: Verification complete. Status changed to PAID or REJECTED.
 */

export default router;
