import { Router } from 'express';
import {
  createCheckoutSession,
  stripeWebhookHandler,
} from '../controllers/payment.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /payments/webhook:
 *   post:
 *     summary: Stripe webhook endpoint — handles payment events from Stripe
 *     tags: [Payments]
 *     description: |
 *       This endpoint is called automatically by Stripe when payment events occur.
 *       It verifies the Stripe signature and creates an Enrollment + Payment record on checkout.session.completed.
 *       **Do not call this manually** — it requires a raw body and a valid Stripe-Signature header.
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Webhook received
 *       400:
 *         description: Invalid Stripe signature
 */
// NOTE: The webhook route is mounted DIRECTLY on the express app in index.js (before express.json())
// so it can receive the raw buffer body required for Stripe signature verification.
// This file exports stripeWebhookHandler to allow that direct mounting.
export { stripeWebhookHandler };

/**
 * @swagger
 * /payments/checkout-session:
 *   post:
 *     summary: Create a Stripe Checkout Session for a course purchase (student)
 *     tags: [Payments]
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
 *                 description: The ID of the course to purchase
 *                 example: "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
 *               couponCode:
 *                 type: string
 *                 description: Optional coupon code to apply a discount
 *                 example: "WELCOME20"
 *     responses:
 *       200:
 *         description: Checkout session created — redirect user to sessionUrl
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessionId:
 *                       type: string
 *                       example: "cs_test_a1B2c3..."
 *                     sessionUrl:
 *                       type: string
 *                       format: uri
 *                       example: "https://checkout.stripe.com/pay/cs_test_..."
 *                     course:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         title:
 *                           type: string
 *                         originalPrice:
 *                           type: number
 *                         finalPrice:
 *                           type: string
 *                         couponApplied:
 *                           type: string
 *                           nullable: true
 *       400:
 *         description: Validation error or course not published
 *       401:
 *         description: Not authenticated
 *       404:
 *         description: Course not found
 *       409:
 *         description: Already enrolled in this course
 */
router.post(
  '/checkout-session',
  protect,
  restrictTo('student'),
  createCheckoutSession
);

export default router;
