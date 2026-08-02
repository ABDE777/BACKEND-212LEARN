import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

const courseSelect = {
  id: true,
  title: true,
  price: true,
  level: true,
  language: true,
  status: true,
  category: { select: { id: true, name: true } },
};

// GET /api/v1/wishlist
export const getWishlist = async (req, res, next) => {
  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      include: { course: { select: courseSelect } },
      orderBy: { id: 'asc' },
    });

    res.status(200).json(successResponse({
      itemCount: items.length,
      items: items.map((item) => ({
        id: item.id,
        courseId: item.courseId,
        course: item.course,
      })),
    }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/wishlist  { courseId }
export const addToWishlist = async (req, res, next) => {
  try {
    validateRequired(req.body, ['courseId']);
    validateUUID(req.body.courseId, 'courseId');

    const { courseId } = req.body;

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, status: true, deletedAt: true },
    });

    if (!course || course.deletedAt || course.status !== 'published') {
      return next(new AppError('Course not found or not available.', 404, 'NOT_FOUND'));
    }

    const existing = await prisma.wishlist.findFirst({
      where: { userId: req.user.id, courseId },
    });

    if (existing) {
      return next(new AppError('Course is already in your wishlist.', 409, 'CONFLICT'));
    }

    const item = await prisma.wishlist.create({
      data: { userId: req.user.id, courseId },
      include: { course: { select: courseSelect } },
    });

    res.status(201).json(successResponse({
      id: item.id,
      courseId: item.courseId,
      course: item.course,
    }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/wishlist/:courseId
export const removeFromWishlist = async (req, res, next) => {
  try {
    validateUUID(req.params.courseId, 'courseId');

    const item = await prisma.wishlist.findFirst({
      where: { userId: req.user.id, courseId: req.params.courseId },
    });

    if (!item) {
      return next(new AppError('Wishlist item not found.', 404, 'NOT_FOUND'));
    }

    await prisma.wishlist.delete({ where: { id: item.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
