import { Router } from 'express';
import { register, login, getMe, forgotPassword, resetPassword, restoreAccountWithOtp, verifyEmail } from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import { rateLimiter } from '../middleware/security.js';

const router = Router();

// Strict rate limiter for sensitive authentication endpoints: max 10 attempts per minute
const authRateLimit = rateLimiter(
  60000,
  10,
  'Too many login or registration attempts. Please try again in a minute.',
  { prefix: 'auth' }
);

// Per-ACCOUNT throttle for password-reset / account-recovery: max 5 attempts per
// email per 15 min. This is keyed by the target email (not the caller IP), so an
// attacker cannot email-bomb one account or brute-force its OTP by rotating IPs.
const accountRecoveryLimit = rateLimiter(
  15 * 60 * 1000,
  5,
  'Too many password reset or account recovery attempts for this account. Please try again later.',
  { prefix: 'auth-acct', keyBy: (req) => req.body?.email || null }
);

/**
 * @swagger
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterInput'
 *     responses:
 *       201:
 *         description: User created — returns JWT token + user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Validation error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       409:
 *         description: Email already taken
 */
router.post('/register', authRateLimit, register);
router.post('/signup', authRateLimit, register);

/**
 * @swagger
 * /auth/login:
 *   post:
 *     summary: Login and receive JWT token
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginInput'
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Missing fields
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', authRateLimit, login);

/**
 * @swagger
 * /auth/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags: [Auth]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', protect, getMe);

/**
 * @swagger
 * /auth/forgot-password:
 *   post:
 *     summary: Request a password reset link by email
 *     description: |
 *       Sends a **5-minute** password reset link to the user's email address.
 *       Always returns `200` even if the email is not found — this prevents
 *       email enumeration attacks (nobody can tell if an account exists or not).
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ForgotPasswordInput'
 *     responses:
 *       200:
 *         description: Reset link sent (or silently ignored if email not found)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Missing or invalid email format
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/forgot-password', authRateLimit, accountRecoveryLimit, forgotPassword);

/**
 * @swagger
 * /auth/reset-password/{token}:
 *   post:
 *     summary: Reset password using the token received by email
 *     description: |
 *       Validates the JWT token from the reset email link and sets a new password.
 *       The token is **valid for 5 minutes** and becomes **invalid after first use**
 *       (because the signing secret includes the old password hash).
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         description: JWT reset token extracted from the email link URL
 *         schema:
 *           type: string
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ResetPasswordInput'
 *     responses:
 *       200:
 *         description: Password reset successfully — user can now log in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Token is invalid, tampered, or expired
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */
router.post('/reset-password/:token', authRateLimit, resetPassword);

/**
 * @swagger
 * /auth/verify-email/{token}:
 *   post:
 *     summary: Confirm a learner's email address from the verification link
 *     tags: [Auth]
 *     parameters:
 *       - in: path
 *         name: token
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Email verified successfully
 *       400:
 *         description: Invalid or expired verification token
 */
router.post('/verify-email/:token', authRateLimit, verifyEmail);

/**
 * @swagger
 * /auth/restore-account:
 *   post:
 *     summary: Restore a soft-deleted account using an OTP received by email
 *     description: |
 *       After a deleted-account login attempt, a 6-digit OTP is emailed to the user.
 *       Submit `email` + `otp` here to restore the account and receive a login token.
 *       OTP is valid for **15 minutes** and single-use.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, otp]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               otp:
 *                 type: string
 *                 example: "483920"
 *     responses:
 *       200:
 *         description: Account restored — returns JWT token + user object
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthResponse'
 *       400:
 *         description: Invalid or expired OTP
 */
router.post('/restore-account', authRateLimit, accountRecoveryLimit, restoreAccountWithOtp);

export default router;

