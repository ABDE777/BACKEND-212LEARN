import { Router } from 'express';
import {
  requestTransferPayment,
  submitTransferDetails,
  getPendingTransfers,
  verifyTransferPayment,
} from '../controllers/transfer.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = Router();

// Student-facing routes
router.post('/request', protect, restrictTo('student'), requestTransferPayment);
router.post(
  '/submit',
  protect,
  restrictTo('student'),
  upload.single('transferReceipt'), // Cloudinary photo upload for transfer receipt
  submitTransferDetails
);

// Admin-facing routes
router.get('/pending', protect, restrictTo('admin'), getPendingTransfers);
router.patch('/verify', protect, restrictTo('admin'), verifyTransferPayment);

/**
 * @swagger
 * /payments/transfer/request:
 *   post:
 *     summary: Request a bank transfer payment for a course (student)
 *     tags: [Bank Transfer]
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
 *         description: Request initialized - Payment state is set to PENDING, returns bank RIB information
 * 
 * /payments/transfer/submit:
 *   post:
 *     summary: Submit the bank transfer receipt and RIB (student)
 *     tags: [Bank Transfer]
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
 *               - rib
 *             properties:
 *               paymentReference:
 *                 type: string
 *                 description: Reference ID returned by the request endpoint
 *                 example: "TRF-K7J9M3N2"
 *               rib:
 *                 type: string
 *                 pattern: "^\\d{24}$"
 *                 description: Bank RIB (24 digits for Morocco)
 *                 example: "01178000011800000000123456"
 *               transferReceipt:
 *                 type: string
 *                 format: binary
 *                 description: Image of the transfer receipt (relevé de virement)
 *     responses:
 *       200:
 *         description: Transfer details uploaded successfully. Status changes to WAITING_VERIFICATION.
 * 
 * /payments/transfer/pending:
 *   get:
 *     summary: List bank transfer transactions waiting validation (admin only)
 *     tags: [Bank Transfer]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of transactions in WAITING_VERIFICATION state
 * 
 * /payments/transfer/verify:
 *   patch:
 *     summary: Approve or reject a bank transfer payment (admin only)
 *     tags: [Bank Transfer]
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
 *                 example: "RIB does not match our records. Please verify."
 *     responses:
 *       200:
 *         description: Verification complete. Status changed to PAID or REJECTED.
 */

export default router;
