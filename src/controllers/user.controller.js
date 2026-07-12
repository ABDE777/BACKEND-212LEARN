import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';

const USER_SELECT = {
  id: true, firstName: true, lastName: true, email: true,
  role: true, isVerified: true, avatar: true, bio: true,
  createdAt: true, lastLogin: true,
};

const SORTABLE_FIELDS = ['createdAt', 'firstName', 'lastName', 'email', 'role'];

// GET /api/v1/users?page=1&limit=20&role=admin&sort=createdAt&order=desc
export const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { role, search } = req.query;

    const where = {
      deletedAt: null,
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
      prisma.user.findMany({ where, select: USER_SELECT, orderBy, skip, take: limit }),
    ]);

    res.status(200).json(successResponse({ users }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id
export const getUser = async (req, res, next) => {
  try {
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
