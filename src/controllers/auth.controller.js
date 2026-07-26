import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

const signToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET || 'dev-secret-key-212learn', {
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

    if (!firstName || !lastName || !email || !password) {
      return next(new AppError(
        'firstName, lastName, email and password are required.',
        400, 'VALIDATION_ERROR'
      ));
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

    if (!email || !password) {
      return next(new AppError('email and password are required.', 400, 'VALIDATION_ERROR'));
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: { ...USER_PUBLIC_FIELDS, passwordHash: true, deletedAt: true },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return next(new AppError('Incorrect email or password.', 401, 'INVALID_CREDENTIALS'));
    }

    if (user.deletedAt) {
      return next(new AppError('This account has been deactivated.', 401, 'ACCOUNT_DEACTIVATED'));
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
