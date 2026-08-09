import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateRequired, validateEmail } from '../utils/validation.js';
import { sendPasswordResetEmail, sendAccountRestoreOtpEmail } from '../utils/email.js';
import { getJwtSecret } from '../config/jwt.js';
import { logAuditEvent } from '../utils/audit.js';

const signToken = (id) =>
  jwt.sign({ id }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const USER_PUBLIC_FIELDS = {
  id: true, firstName: true, lastName: true, email: true,
  role: true, avatar: true, bio: true, isVerified: true,
  createdAt: true, updatedAt: true, lastLogin: true,
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user.id);
  const { passwordHash, deletedAt, ...safeUser } = user;

  // Success envelope + token at top level (JWT should not be buried in data)
  res.status(statusCode).json({
    ...successResponse({ user: safeUser }),
    token,
  });
};

// POST /api/v1/auth/register
export const register = async (req, res, next) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    validateRequired(req.body, ['firstName', 'lastName', 'email', 'password']);
    validateEmail(email);

    if (String(password).length < 8) {
      return next(new AppError('Password must be at least 8 characters.', 400, 'VALIDATION_ERROR'));
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        firstName, lastName, email, passwordHash,
        role: 'student',
        isVerified: false,
      },
      select: { ...USER_PUBLIC_FIELDS, passwordHash: true, deletedAt: true },
    });

    sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/auth/login
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    validateRequired(req.body, ['email', 'password']);
    validateEmail(email);

    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...USER_PUBLIC_FIELDS, passwordHash: true, deletedAt: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('Incorrect email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    // Deleted account — send OTP to allow self-restoration
    if (user.deletedAt) {
      const otp = String(crypto.randomInt(100000, 999999)); // 6-digit OTP
      const otpHash = await bcrypt.hash(otp, 10);
      const otpExp = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

      await prisma.user.update({
        where: { id: user.id },
        data: { restoreOtp: otpHash, restoreOtpExp: otpExp },
      });

      // Fire-and-forget — don't block the response
      sendAccountRestoreOtpEmail(user.email, user.firstName, otp).catch(() => {});

      return res.status(200).json({
        success: true,
        requiresRestore: true,
        message: 'Votre compte a été désactivé. Un code de restauration a été envoyé à votre adresse email.',
      });
    }

    // Update lastLogin without blocking the response
    prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } }).catch(() => {});

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/me
export const getMe = (req, res) => {
  const { passwordHash, deletedAt, ...safeUser } = req.user;
  res.status(200).json(successResponse({ user: safeUser }));
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/users/me/password
// Logged-in user changes their own password (requires current password).
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    validateRequired(req.body, ['currentPassword', 'newPassword']);
    const { currentPassword, newPassword } = req.body;

    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters.', 400, 'VALIDATION_ERROR'));
    }

    if (currentPassword === newPassword) {
      return next(new AppError('New password cannot be the same as your old password.', 400, 'VALIDATION_ERROR'));
    }

    // Fetch fresh user row including passwordHash
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, passwordHash: true },
    });

    if (!user) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return next(new AppError('Current password is incorrect.', 401, 'INVALID_CREDENTIALS'));
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.status(200).json(successResponse({ message: 'Password updated successfully.' }));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/forgot-password
// Public: receives an email, sends a 5-min reset link if the account exists.
// Always returns 200 to prevent email enumeration attacks.
// ─────────────────────────────────────────────────────────────────────────────
export const forgotPassword = async (req, res, next) => {
  try {
    validateRequired(req.body, ['email']);
    validateEmail(req.body.email);
    const { email } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, firstName: true, email: true, passwordHash: true, deletedAt: true },
    });

    // Always respond 200 — never reveal whether the email exists
    if (!user || user.deletedAt) {
      return res.status(200).json(
        successResponse({ message: 'If that email is registered, a reset link has been sent.' })
      );
    }

    // Create a short-lived reset token (5 min) signed with a dedicated secret
    const resetSecret = (getJwtSecret()) + user.passwordHash;
    const resetToken = jwt.sign({ id: user.id }, resetSecret, { expiresIn: '5m' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://212-learn.vercel.app';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(user.email, user.firstName, resetLink);

    res.status(200).json(
      successResponse({ message: 'If that email is registered, a reset link has been sent.' })
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/reset-password/:token
// Public: validates the reset token and sets the new password.
// ─────────────────────────────────────────────────────────────────────────────
export const resetPassword = async (req, res, next) => {
  try {
    validateRequired(req.body, ['newPassword']);
    const { newPassword } = req.body;
    const { token } = req.params;

    if (!token) {
      return next(new AppError('Reset token is required.', 400, 'VALIDATION_ERROR'));
    }

    if (newPassword.length < 8) {
      return next(new AppError('New password must be at least 8 characters.', 400, 'VALIDATION_ERROR'));
    }

    // Decode the token without verifying yet to get the user id
    let decoded;
    try {
      decoded = jwt.decode(token);
    } catch {
      return next(new AppError('Invalid reset token.', 400, 'INVALID_TOKEN'));
    }

    if (!decoded || !decoded.id) {
      return next(new AppError('Invalid reset token.', 400, 'INVALID_TOKEN'));
    }

    // Fetch the user to rebuild the signing secret (which includes the current hash)
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, passwordHash: true, deletedAt: true },
    });

    if (!user || user.deletedAt) {
      return next(new AppError('Invalid reset token.', 400, 'INVALID_TOKEN'));
    }

    // Now fully verify using the hash-based secret (token auto-invalidates after password change)
    const resetSecret = (getJwtSecret()) + user.passwordHash;
    try {
      jwt.verify(token, resetSecret);
    } catch (err) {
      const message = err.name === 'TokenExpiredError'
        ? 'Reset link has expired. Please request a new one.'
        : 'Invalid reset token.';
      return next(new AppError(message, 400, 'INVALID_TOKEN'));
    }

    // Check if new password is identical to current password
    const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
    if (isSamePassword) {
      return next(new AppError('New password cannot be the same as your old password.', 400, 'VALIDATION_ERROR'));
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    res.status(200).json(successResponse({ message: 'Password reset successfully. You can now log in.' }));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/v1/auth/restore-account
// Public: validates email + OTP and restores the soft-deleted account.
// Returns a full login token on success (equivalent to a normal login).
// ─────────────────────────────────────────────────────────────────────────────
export const restoreAccountWithOtp = async (req, res, next) => {
  try {
    validateRequired(req.body, ['email', 'otp']);
    validateEmail(req.body.email);
    const { email, otp } = req.body;

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        ...USER_PUBLIC_FIELDS,
        passwordHash: true,
        deletedAt: true,
        restoreOtp: true,
        restoreOtpExp: true,
      },
    });

    // Generic error — never reveal exact reason to prevent user enumeration
    const invalid = () => next(new AppError('Code de restauration invalide ou expiré.', 400, 'INVALID_OTP'));

    if (!user || !user.deletedAt) return invalid();
    if (!user.restoreOtp || !user.restoreOtpExp) return invalid();
    if (new Date() > new Date(user.restoreOtpExp)) return invalid();

    const otpMatch = await bcrypt.compare(String(otp).trim(), user.restoreOtp);
    if (!otpMatch) return invalid();

    // Restore the account and clear OTP fields atomically
    const restoredUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        deletedAt: null,
        restoreOtp: null,
        restoreOtpExp: null,
        lastLogin: new Date(),
      },
      select: { ...USER_PUBLIC_FIELDS, passwordHash: true, deletedAt: true },
    });

    // Log audit event (best-effort)
    logAuditEvent(user.id, 'SELF_RESTORE_USER', 'User', user.id, { email: user.email }).catch(() => {});

    sendTokenResponse(restoredUser, 200, res);
  } catch (error) {
    next(error);
  }
};

