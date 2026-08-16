import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from './error.js';
import { getJwtSecret } from '../config/jwt.js';

export const protect = async (req, res, next) => {
  try {
    let token;

    // 1) Check if token is present in Authorization header
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in. Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = jwt.verify(token, getJwtSecret());

    // 3) Check if user still exists
    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: {
        studentProfile: true,
        instructorProfile: true,
      },
    });

    if (!currentUser) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    if (currentUser.deletedAt) {
      return next(new AppError('This account has been deactivated.', 401, 'ACCOUNT_DEACTIVATED'));
    }

    // 4) Reject tokens issued before the user's last password change, so a
    // stolen/leaked token stops working as soon as the password is changed
    // instead of staying valid for the rest of its 7-day lifetime.
    if (currentUser.passwordChangedAt) {
      const passwordChangedAtSeconds = Math.floor(currentUser.passwordChangedAt.getTime() / 1000);
      if (decoded.iat < passwordChangedAtSeconds) {
        return next(new AppError('Your password was changed. Please log in again.', 401, 'PASSWORD_CHANGED'));
      }
    }

    // 4b) Single active session: a login bumps the user's tokenVersion, so a
    // token minted for an older session (lower `tv`) is rejected here — the
    // other device is logged out. Tokens issued before this feature have no
    // `tv` claim and are left alone (they expire naturally / on next login).
    if (typeof decoded.tv === 'number' && decoded.tv !== currentUser.tokenVersion) {
      return next(new AppError('Vous avez été déconnecté car votre compte a été utilisé sur un autre appareil.', 401, 'SESSION_REPLACED'));
    }

    // 5) Grant access to protected route (mount user on request)
    req.user = currentUser;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return next(new AppError('Invalid token. Please log in again.', 401));
    }
    if (error.name === 'TokenExpiredError') {
      return next(new AppError('Your token has expired. Please log in again.', 401));
    }
    next(error);
  }
};

// Middleware to restrict access to specific roles (e.g. 'admin', 'instructor')
export const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};
