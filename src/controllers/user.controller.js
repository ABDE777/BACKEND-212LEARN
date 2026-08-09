import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';
import { cloudinary } from '../config/cloudinary.js';
import { validateUUID } from '../utils/validation.js';

const USER_SELECT = {
  id: true, firstName: true, lastName: true, email: true,
  role: true, isVerified: true, avatar: true, bio: true,
  createdAt: true, lastLogin: true, deletedAt: true,
};

const SORTABLE_FIELDS = ['createdAt', 'firstName', 'lastName', 'email', 'role'];

// GET /api/v1/users?page=1&limit=20&role=admin&sort=createdAt&order=desc&deleted=true
export const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { role, search, deleted, includeDeleted } = req.query;

    let deletedAtFilter = { deletedAt: null };
    if (deleted === 'true' || deleted === true || deleted === 'only') {
      deletedAtFilter = { deletedAt: { not: null } };
    } else if (includeDeleted === 'true' || includeDeleted === true) {
      deletedAtFilter = {};
    }

    const where = {
      ...deletedAtFilter,
      ...(role && { role }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
          { email:     { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({ where, select: USER_SELECT, orderBy, ...(skip !== undefined && { skip }), ...(limit !== null && { take: limit }) }),
    ]);

    res.status(200).json(successResponse({ users }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id
export const getUser = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'userId');

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: USER_SELECT,
    });

    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));

    res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/me
export const updateMe = async (req, res, next) => {
  try {
    // Block attempts to escalate role or change password through this endpoint
    const { password, role, passwordHash, ...allowed } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: allowed,
      select: USER_SELECT,
    });

    res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/me  →  soft-delete, 204 No Content
export const deleteMe = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { deletedAt: new Date() },
    });

    // 204 must NOT have a body
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/me/avatar  →  upload avatar image
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded.', 400, 'VALIDATION_ERROR'));
    }

    // Delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatar: true },
    });

    if (currentUser.avatar) {
      try {
        // Extract public ID from Cloudinary URL
        const publicId = currentUser.avatar.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`212learn/images/${publicId}`);
      } catch (err) {
        // Ignore deletion errors
        console.warn('Failed to delete old avatar:', err.message);
      }
    }

    // Update user with new avatar URL
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: req.file.path },
      select: USER_SELECT,
    });

    res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};
