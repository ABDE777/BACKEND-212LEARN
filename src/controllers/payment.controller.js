import Stripe from 'stripe';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_212learn_dev_placeholder', {
  apiVersion: '2026-06-24.dahlia',
});

// ─── POST /api/v1/payments/checkout-session ──────────────────────────────────
// Creates a Stripe Checkout Session for a course purchase.
// The student is redirected to Stripe's hosted page to complete payment.
export const createCheckoutSession = async (req, res, next) => {
  try {
    const { courseId, couponCode } = req.body;
    const userId = req.user.id;

    if (!courseId) {
      return next(new AppError('courseId is required.', 400, 'VALIDATION_ERROR'));
    }

    // Fetch course details
    const course = await prisma.course.findUnique({
      where: { id: courseId },
      include: { instructors: { include: { user: true } } },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    if (course.status !== 'published') {
      return next(new AppError('This course is not yet available for purchase.', 400, 'BAD_REQUEST'));
    }

    // Check if the student is already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId },
    });

    if (existingEnrollment) {
      return next(new AppError('You are already enrolled in this course.', 409, 'CONFLICT'));
    }

    // Resolve coupon if provided
    let coupon = null;
    let discountedPrice = Number(course.price);

    if (couponCode) {
      coupon = await prisma.coupon.findUnique({ where: { code: couponCode } });
      if (!coupon) {
        return next(new AppError(`Coupon code "${couponCode}" is not valid.`, 400, 'VALIDATION_ERROR'));
      }
      if (new Date(coupon.expirationDate) < new Date()) {
        return next(new AppError(`Coupon code "${couponCode}" has expired.`, 400, 'VALIDATION_ERROR'));
      }
      const discountFraction = Number(coupon.discount) / 100;
      discountedPrice = discountedPrice * (1 - discountFraction);
    }

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(discountedPrice * 100), // Stripe works in cents
            product_data: {
              name: course.title,
              description: course.description?.substring(0, 250) || '212LEARN Course',
            },
          },
          quantity: 1,
        },
      ],
      // Metadata is passed back in the webhook event so we can create the enrollment
      metadata: {
        userId,
        courseId,
        couponId: coupon?.id || '',
        originalPrice: String(course.price),
        finalPrice: String(discountedPrice.toFixed(2)),
      },
      success_url: `${frontendUrl}/courses/${courseId}?payment=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${frontendUrl}/courses/${courseId}?payment=cancelled`,
    });

    res.status(200).json(
      successResponse({
        sessionId:  session.id,
        sessionUrl: session.url,
        course: {
          id:           course.id,
          title:        course.title,
          originalPrice: course.price,
          finalPrice:   discountedPrice.toFixed(2),
          couponApplied: coupon ? coupon.code : null,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/payments/webhook ───────────────────────────────────────────
// Handles Stripe webhook events.
// This route receives raw body so Stripe can verify the webhook signature.
export const stripeWebhookHandler = async (req, res, next) => {
  const sig     = req.headers['stripe-signature'];
  const secret  = process.env.STRIPE_WEBHOOK_SECRET || '';
  let event;

  try {
    if (secret && sig) {
      // Verify webhook signature (production/staging)
      event = stripe.webhooks.constructEvent(req.body, sig, secret);
    } else {
      // Local development without a webhook secret — parse body directly
      const body = req.body instanceof Buffer ? req.body.toString('utf8') : req.body;
      event = typeof body === 'string' ? JSON.parse(body) : body;
    }
  } catch (err) {
    console.error(`[Stripe] Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: `Webhook error: ${err.message}` });
  }

  // Handle specific events
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, courseId, couponId, originalPrice, finalPrice } = session.metadata || {};

    if (!userId || !courseId) {
      console.error('[Stripe] Webhook missing required metadata — skipping enrollment.');
      return res.status(200).json({ received: true });
    }

    try {
      // Transactional: create enrollment AND payment record together
      await prisma.$transaction(async (tx) => {
        // Check for duplicate webhook delivery (idempotency)
        const existingPayment = await tx.payment.findUnique({
          where: { transactionReference: session.payment_intent || session.id },
        });

        if (existingPayment) {
          console.log(`[Stripe] Payment ${session.id} already processed — skipping.`);
          return;
        }

        // Check for existing enrollment (guard against duplicates)
        const existingEnrollment = await tx.enrollment.findFirst({
          where: { userId, courseId },
        });

        let enrollment = existingEnrollment;
        if (!enrollment) {
          enrollment = await tx.enrollment.create({
            data: { userId, courseId },
          });
          console.log(`[Stripe] Enrollment created: user ${userId} → course ${courseId}`);
        }

        // Record the payment history
        await tx.payment.create({
          data: {
            enrollmentId:         enrollment.id,
            amount:               Number(finalPrice || originalPrice),
            currency:             session.currency?.toUpperCase() || 'USD',
            provider:             'stripe',
            transactionReference: session.payment_intent || session.id,
            status:               'paid',
            paidAt:               new Date(),
            couponId:             couponId || null,
          },
        });

        console.log(`[Stripe] Payment recorded for enrollment ${enrollment.id}`);
      });
    } catch (dbError) {
      console.error('[Stripe] Database transaction failed:', dbError);
      // Return 200 to prevent Stripe retrying (retry logic causes duplicates)
      // Log the error for manual investigation
    }
  } else {
    console.log(`[Stripe] Unhandled event type: ${event.type}`);
  }

  // Always acknowledge receipt to Stripe
  res.status(200).json({ received: true });
};
