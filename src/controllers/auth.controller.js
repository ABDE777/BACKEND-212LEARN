import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateRequired, validateEmail, validateEmailAsync, validatePhoneNumber, isDisposableEmail, validatePassword } from '../utils/validation.js';
import { validateLearnerProfile, validateInstructorProfile, toDateOrNull } from '../utils/registrationValidation.js';
import { sendPasswordResetEmail, sendAccountRestoreOtpEmail, sendVerificationEmail } from '../utils/email.js';
import { getJwtSecret } from '../config/jwt.js';
import { logAuditEvent } from '../utils/audit.js';
import { getAppSettings } from '../utils/settings.js';

// A fixed bcrypt hash used to equalize timing when an email is not found, so a
// login attempt takes the same time whether or not the account exists (defeats
// user-enumeration via response timing). Computed once at module load.
const DUMMY_PASSWORD_HASH = bcrypt.hashSync('timing-equalizer-not-a-real-password', 12);

const signToken = (id, tokenVersion = 0) =>
  jwt.sign({ id, tv: tokenVersion }, getJwtSecret(), {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// Dedicated secret + purpose claim so a login token can never be replayed as an
// email-verification token and vice-versa.
const EMAIL_VERIFY_SECRET = () => `${getJwtSecret()}-verify-email`;
const signEmailVerifyToken = (id) =>
  jwt.sign({ id, purpose: 'verify-email' }, EMAIL_VERIFY_SECRET(), { expiresIn: '48h' });

// Send the account-verification email to a learner (best-effort, non-blocking).
const sendLearnerVerificationEmail = (user) => {
  try {
    const token = signEmailVerifyToken(user.id);
    const frontendUrl = process.env.FRONTEND_URL || 'https://212-learn.vercel.app';
    const link = `${frontendUrl}/verify-email/${token}`;
    sendVerificationEmail(user.email, user.firstName, link).catch(() => {});
  } catch {
    // never block registration on email failure
  }
};

const USER_PUBLIC_FIELDS = {
  id: true, firstName: true, lastName: true, email: true,
  role: true, avatar: true, bio: true, isVerified: true,
  createdAt: true, updatedAt: true, lastLogin: true, phone: true,
};

const sendTokenResponse = (user, statusCode, res) => {
  const token = signToken(user.id, user.tokenVersion ?? 0);
  const { passwordHash, deletedAt, restoreOtp, restoreOtpExp, studentProfile, instructorProfile, ...safeUser } = user;

  // Include profile data based on role
  const profileData = safeUser.role === 'student' || safeUser.role === 'employee' ? studentProfile :
                      safeUser.role === 'instructor' ? instructorProfile : null;

  const userWithProfile = {
    ...safeUser,
    studentProfile: (safeUser.role === 'student' || safeUser.role === 'employee') ? profileData : null,
    instructorProfile: safeUser.role === 'instructor' ? profileData : null,
    profile: profileData, // role-agnostic alias so every endpoint exposes `profile`
  };

  // Success envelope + token at top level (JWT should not be buried in data)
  res.status(statusCode).json({
    ...successResponse({ user: userWithProfile }),
    token,
  });
};

// POST /api/v1/auth/register
export const register = async (req, res, next) => {
  try {
    // Respect the admin "Inscriptions ouvertes" setting, and block all signups
    // while the platform is in maintenance mode.
    const settings = await getAppSettings();
    if (settings.maintenanceMode) {
      return next(new AppError('La plateforme est en maintenance. Les inscriptions sont temporairement désactivées.', 503, 'MAINTENANCE'));
    }
    if (!settings.allowRegistrations) {
      return next(new AppError('New registrations are currently closed.', 403, 'REGISTRATIONS_CLOSED'));
    }

    const {
      firstName,
      lastName,
      email,
      password,
      role = 'student',
      phone,
      studentProfile,
      instructorProfile
    } = req.body;

    validateRequired(req.body, ['firstName', 'lastName', 'email', 'password', 'role']);
    await validateEmailAsync(email);

    validatePassword(password);

    const formattedPhone = phone ? validatePhoneNumber(phone) : null;

    if (!['student', 'instructor', 'employee'].includes(role)) {
      return next(new AppError('Invalid role. Only student, instructor, and employee roles are allowed for public registration.', 400, 'VALIDATION_ERROR'));
    }

    const isLearner = role === 'student' || role === 'employee';

    if (isLearner && !studentProfile) {
      return next(new AppError('Profile information is required.', 400, 'VALIDATION_ERROR'));
    }

    if (role === 'instructor' && !instructorProfile) {
      return next(new AppError('Instructor profile information is required.', 400, 'VALIDATION_ERROR'));
    }

    // Enforce the situation-specific required fields + value enums that the
    // registration form declares (throws AppError on any violation).
    let learnerSelfDirected = false;
    if (isLearner) {
      ({ isSelfDirected: learnerSelfDirected } = validateLearnerProfile(studentProfile));
    } else if (role === 'instructor') {
      validateInstructorProfile(instructorProfile);
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userData = {
      firstName,
      lastName,
      email: email.trim().toLowerCase(),
      passwordHash,
      role,
      phone: formattedPhone || null,
      isVerified: false,
    };

    if (isLearner && studentProfile) {
      userData.studentProfile = {
        create: {
          situation: studentProfile.situation,
          school: studentProfile.school || null,
          fieldOfStudy: studentProfile.fieldOfStudy || null,
          educationLevel: studentProfile.educationLevel || null,
          academicYearStart: toDateOrNull(studentProfile.academicYearStart, 'academicYearStart'),
          academicYearEnd: toDateOrNull(studentProfile.academicYearEnd, 'academicYearEnd'),
          companyName: studentProfile.companyName || null,
          department: studentProfile.department || null,
          position: studentProfile.position || null,
          sector: studentProfile.sector || null,
          experienceYears: studentProfile.experienceYears || null,
          interests: studentProfile.interests || null,
          learningObjective: studentProfile.learningObjective || null,
          currentLevel: studentProfile.currentLevel || null,
          group: null, // Always null - assigned by admin/instructor later
          isSelfDirected: learnerSelfDirected,
        }
      };
    }

    if (role === 'instructor' && instructorProfile) {
      userData.instructorProfile = {
        create: {
          situation: instructorProfile.situation,
          expertiseDomain: instructorProfile.expertiseDomain || null,
          specialization: instructorProfile.specialization,
          organization: instructorProfile.organization || null,
          department: instructorProfile.department || null,
          position: instructorProfile.position || null,
          sector: instructorProfile.sector || null,
          experienceYears: instructorProfile.experienceYears,
          teachingMode: instructorProfile.teachingMode,
          teachingDomains: instructorProfile.teachingDomains || null,
        }
      };
    }

    const user = await prisma.user.create({
      data: userData,
      include: {
        studentProfile: true,
        instructorProfile: true,
      },
    });

    // Learners self-verify by email (instructors are approved by an admin via
    // KYC). Fire-and-forget so a mail hiccup never blocks signup.
    if (isLearner) {
      sendLearnerVerificationEmail(user);
    }

    logAuditEvent(user.id, 'REGISTER', 'User', user.id, { role: user.role, email: user.email }).catch(() => {});

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

    // Match the email case-insensitively and trimmed, so accounts created or
    // registered with different casing / stray whitespace still log in.
    // Emails are stored normalized (trim + lowercase), so look up by the
    // normalized value with findUnique — this uses the unique index instead of
    // a case-insensitive sequential scan (critical once the users table is large).
    const user = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      include: {
        studentProfile: true,
        instructorProfile: true,
      },
    });

    // Always run a bcrypt compare — against a dummy hash when the user doesn't
    // exist — so the response time is the same for unknown vs. known emails
    // (prevents user-enumeration via timing).
    const passwordMatches = user
      ? await bcrypt.compare(password, user.passwordHash)
      : await bcrypt.compare(password, DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      return next(new AppError('Incorrect email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    // Maintenance lockout: while maintenance mode is on, only admins may log in.
    if (user.role !== 'admin') {
      const settings = await getAppSettings();
      if (settings.maintenanceMode) {
        return next(new AppError('La plateforme est en maintenance. Connexion temporairement indisponible.', 503, 'MAINTENANCE'));
      }
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

    // Rotate the token version so any other active session for this account is
    // invalidated (single active session per account), and record lastLogin.
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { tokenVersion: { increment: 1 }, lastLogin: new Date() },
      select: { tokenVersion: true },
    });
    user.tokenVersion = updated.tokenVersion;

    logAuditEvent(user.id, 'LOGIN', 'User', user.id, { email: user.email, role: user.role }).catch(() => {});

    sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/auth/me
export const getMe = async (req, res, next) => {
  try {
    const { passwordHash, deletedAt, restoreOtp, restoreOtpExp, studentProfile, instructorProfile, ...safeUser } = req.user;
    
    // Include profile data based on role (already fetched by auth middleware)
    const profileData = safeUser.role === 'student' || safeUser.role === 'employee' ? studentProfile :
                        safeUser.role === 'instructor' ? instructorProfile : null;
    
    res.status(200).json(successResponse({
      user: {
        ...safeUser,
        studentProfile: (safeUser.role === 'student' || safeUser.role === 'employee') ? profileData : null,
        instructorProfile: safeUser.role === 'instructor' ? profileData : null,
        profile: profileData, // role-agnostic alias so every endpoint exposes `profile`
      }
    }));
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/users/me/password
// Logged-in user changes their own password (requires current password).
// ─────────────────────────────────────────────────────────────────────────────
export const changePassword = async (req, res, next) => {
  try {
    validateRequired(req.body, ['currentPassword', 'newPassword']);
    const { currentPassword, newPassword } = req.body;

    validatePassword(newPassword, 'New password');

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
      where: { id: req.user.id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

export const checkEmail = async (req, res, next) => {
  try {
    const { email } = req.query;
    if (!email || !email.trim()) {
      return res.status(200).json({ success: true, available: true, exists: false });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Reject disposable / tempmail addresses immediately
    if (isDisposableEmail(cleanEmail)) {
      return res.status(200).json({
        success: true,
        available: false,
        exists: false,
        isDisposable: true,
        message: 'Les emails temporaires ou jetables (tempmail) ne sont pas autorisés.',
      });
    }

    // Index-using lookup on the normalized email (emails are stored lowercased).
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
      select: { id: true, deletedAt: true },
    });
    const taken = Boolean(existingUser && !existingUser.deletedAt);

    return res.status(200).json({
      success: true,
      available: !taken,
      exists: taken,
    });
  } catch (error) {
    next(error);
  }
};

export const checkPhone = async (req, res, next) => {
  try {
    const { phone } = req.query;
    if (!phone || !phone.trim()) {
      return res.status(200).json({ success: true, available: true, exists: false });
    }

    const cleanPhone = phone.trim();
    let formattedPhone = cleanPhone;

    // Validate phone number format
    try {
      formattedPhone = validatePhoneNumber(cleanPhone);
    } catch (err) {
      return res.status(200).json({
        success: true,
        available: false,
        isValid: false,
        message: 'Numéro de téléphone invalide.',
      });
    }

    const existingUser = await prisma.user.findFirst({
      where: {
        phone: { in: [cleanPhone, formattedPhone] },
        deletedAt: null,
      },
      select: { id: true },
    });

    return res.status(200).json({
      success: true,
      available: !existingUser,
      exists: !!existingUser,
      isValid: true,
      formattedPhone,
    });
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
      where: { email: email.trim().toLowerCase() },
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
// POST /api/v1/auth/verify-email/:token — confirm a learner's email address.
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    if (!token) {
      return next(new AppError('Verification token is required.', 400, 'VALIDATION_ERROR'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, EMAIL_VERIFY_SECRET());
    } catch {
      return next(new AppError('Lien de vérification invalide ou expiré.', 400, 'INVALID_TOKEN'));
    }
    if (decoded.purpose !== 'verify-email') {
      return next(new AppError('Lien de vérification invalide.', 400, 'INVALID_TOKEN'));
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, isVerified: true, deletedAt: true },
    });
    if (!user || user.deletedAt) {
      return next(new AppError('Compte introuvable.', 404, 'NOT_FOUND'));
    }

    if (!user.isVerified) {
      await prisma.user.update({ where: { id: user.id }, data: { isVerified: true } });
      logAuditEvent(user.id, 'VERIFY_EMAIL', 'User', user.id, { email: user.email }).catch(() => {});
    }

    res.status(200).json(successResponse({ message: 'Adresse email confirmée avec succès.', verified: true }));
  } catch (error) {
    next(error);
  }
};

export const resetPassword = async (req, res, next) => {
  try {
    validateRequired(req.body, ['newPassword']);
    const { newPassword } = req.body;
    const { token } = req.params;

    if (!token) {
      return next(new AppError('Reset token is required.', 400, 'VALIDATION_ERROR'));
    }

    validatePassword(newPassword, 'New password');

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
      data: { passwordHash, passwordChangedAt: new Date() },
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
        tokenVersion: { increment: 1 }, // fresh single session on restore
      },
      select: { ...USER_PUBLIC_FIELDS, passwordHash: true, deletedAt: true, tokenVersion: true },
    });

    // Log audit event (best-effort)
    logAuditEvent(user.id, 'SELF_RESTORE_USER', 'User', user.id, { email: user.email }).catch(() => {});

    sendTokenResponse(restoredUser, 200, res);
  } catch (error) {
    next(error);
  }
};

