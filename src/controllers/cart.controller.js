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

async function getOrCreateCart(userId) {
  return prisma.cart.upsert({
    where: { userId },
    create: { userId },
    update: {},
    include: {
      items: {
        include: { course: { select: courseSelect } },
        orderBy: { id: 'asc' },
      },
    },
  });
}

function summarizeCart(cart) {
  const items = cart.items || [];
  const subtotal = items.reduce((sum, item) => sum + Number(item.course?.price || 0), 0);
  return {
    id: cart.id,
    userId: cart.userId,
    itemCount: items.length,
    subtotal: Math.round(subtotal * 100) / 100,
    currency: 'MAD',
    items: items.map((item) => ({
      id: item.id,
      courseId: item.courseId,
      course: item.course,
    })),
  };
}

// GET /api/v1/cart
export const getCart = async (req, res, next) => {
  try {
    const cart = await getOrCreateCart(req.user.id);
    res.status(200).json(successResponse(summarizeCart(cart)));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/cart/items  { courseId }
export const addCartItem = async (req, res, next) => {
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

    const enrolled = await prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: req.user.id, courseId } },
      include: { payment: true },
    });

    if (enrolled?.payment?.status === 'PAID') {
      return next(new AppError('Vous êtes déjà inscrit à ce cours.', 409, 'ALREADY_ENROLLED'));
    }

    const cart = await getOrCreateCart(req.user.id);

    const existing = await prisma.cartItem.findFirst({
      where: { cartId: cart.id, courseId },
    });

    if (existing) {
      return next(new AppError('Course is already in your cart.', 409, 'CONFLICT'));
    }

    await prisma.cartItem.create({
      data: { cartId: cart.id, courseId },
    });

    const updated = await getOrCreateCart(req.user.id);
    res.status(201).json(successResponse(summarizeCart(updated)));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart/items/:itemId
export const removeCartItem = async (req, res, next) => {
  try {
    validateUUID(req.params.itemId, 'itemId');

    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (!cart) {
      return next(new AppError('Cart not found.', 404, 'NOT_FOUND'));
    }

    const item = await prisma.cartItem.findUnique({ where: { id: req.params.itemId } });
    if (!item || item.cartId !== cart.id) {
      return next(new AppError('Cart item not found.', 404, 'NOT_FOUND'));
    }

    await prisma.cartItem.delete({ where: { id: item.id } });

    const updated = await getOrCreateCart(req.user.id);
    res.status(200).json(successResponse(summarizeCart(updated)));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/cart
export const clearCart = async (req, res, next) => {
  try {
    const cart = await prisma.cart.findUnique({ where: { userId: req.user.id } });
    if (!cart) {
      return res.status(200).json(successResponse({
        id: null,
        userId: req.user.id,
        itemCount: 0,
        subtotal: 0,
        currency: 'MAD',
        items: [],
      }));
    }

    await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
    const updated = await getOrCreateCart(req.user.id);
    res.status(200).json(successResponse(summarizeCart(updated)));
  } catch (error) {
    next(error);
  }
};
