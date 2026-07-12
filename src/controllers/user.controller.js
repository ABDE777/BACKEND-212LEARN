import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

// GET /api/v1/users (admin only)
export const getAllUsers = async (req, res, next) => {
  try {
    const users = await prisma.user.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isVerified: true,
        avatar: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    res.status(200).json({
      status: 'success',
      results: users.length,
      data: { users },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id (admin only)
export const getUser = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isVerified: true,
        avatar: true,
        bio: true,
        createdAt: true,
        lastLogin: true,
      },
    });

    if (!user) return next(new AppError('No user found with that ID.', 404));

    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/me (authenticated user updates own profile)
export const updateMe = async (req, res, next) => {
  try {
    const { password, role, ...allowed } = req.body; // block password/role changes via this route

    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { ...allowed, updatedAt: new Date() },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        avatar: true,
        bio: true,
        updatedAt: true,
      },
    });

    res.status(200).json({ status: 'success', data: { user } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/me (soft delete)
export const deleteMe = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};
