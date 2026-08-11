import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination } from '../utils/response.js';
import { validateRequired, validateNumberRange, validateDate, validateUUID } from '../utils/validation.js';
import { resolveValidCoupon, applyCouponDiscount } from '../utils/coupon.js';

// GET /api/v1/coupons  (admin)
export const listCoupons = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [total, coupons] = await Promise.all([
      prisma.coupon.count(),
      prisma.coupon.findMany({
        orderBy: { expirationDate: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    res.status(200).json(successResponse(
      {
        coupons: coupons.map((c) => ({
          ...c,
          discount: Number(c.discount),
          isExpired: new Date(c.expirationDate) < new Date(),
        })),
      },
      paginationMeta(total, page, limit)
    ));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/coupons  (admin)
export const createCoupon = async (req, res, next) => {
  try {
    validateRequired(req.body, ['code', 'discount', 'expirationDate']);

    const code = String(req.body.code).trim().toUpperCase();
    const discount = Number(req.body.discount);
    const expirationDate = validateDate(req.body.expirationDate, 'expirationDate');
    const maxUsage = req.body.maxUsage !== undefined ? Number(req.body.maxUsage) : 100;
    const isActive = req.body.isActive !== undefined ? Boolean(req.body.isActive) : true;

    validateNumberRange(discount, { min: 0, max: 100 }, 'discount');
    validateNumberRange(maxUsage, { min: 1, max: 10000 }, 'maxUsage');

    if (expirationDate <= new Date()) {
      return next(new AppError('expirationDate must be in the future.', 400, 'VALIDATION_ERROR'));
    }

    const existing = await prisma.coupon.findUnique({ where: { code } });
    if (existing) {
      return next(new AppError(`Coupon code "${code}" already exists.`, 409, 'CONFLICT'));
    }

    const coupon = await prisma.coupon.create({
      data: { code, discount, expirationDate, maxUsage, currentUsage: 0, isActive },
    });

    res.status(201).json(successResponse({
      ...coupon,
      discount: Number(coupon.discount),
    }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/coupons/:id  (admin)
export const updateCoupon = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'couponId');

    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) {
      return next(new AppError('Coupon not found.', 404, 'NOT_FOUND'));
    }

    const data = {};

    if (req.body.code !== undefined) {
      data.code = String(req.body.code).trim().toUpperCase();
      const clash = await prisma.coupon.findFirst({
        where: { code: data.code, NOT: { id: coupon.id } },
      });
      if (clash) {
        return next(new AppError(`Coupon code "${data.code}" already exists.`, 409, 'CONFLICT'));
      }
    }

    if (req.body.discount !== undefined) {
      const discount = Number(req.body.discount);
      validateNumberRange(discount, { min: 0, max: 100 }, 'discount');
      data.discount = discount;
    }

    if (req.body.expirationDate !== undefined) {
      data.expirationDate = validateDate(req.body.expirationDate, 'expirationDate');
    }

    if (req.body.maxUsage !== undefined) {
      const maxUsage = Number(req.body.maxUsage);
      validateNumberRange(maxUsage, { min: coupon.currentUsage, max: 10000 }, 'maxUsage');
      data.maxUsage = maxUsage;
    }

    if (req.body.isActive !== undefined) {
      data.isActive = Boolean(req.body.isActive);
    }

    const updated = await prisma.coupon.update({
      where: { id: coupon.id },
      data,
    });

    res.status(200).json(successResponse({
      ...updated,
      discount: Number(updated.discount),
    }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/coupons/:id  (admin)
export const deleteCoupon = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'couponId');

    const coupon = await prisma.coupon.findUnique({ where: { id: req.params.id } });
    if (!coupon) {
      return next(new AppError('Coupon not found.', 404, 'NOT_FOUND'));
    }

    await prisma.coupon.delete({ where: { id: coupon.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/coupons/validate  (student / authenticated)
// Body: { code, courseId? } — returns discount preview
export const validateCoupon = async (req, res, next) => {
  try {
    validateRequired(req.body, ['code']);

    const coupon = await resolveValidCoupon(req.body.code);
    let preview = {
      code: coupon.code,
      discountPercent: coupon.discount,
      expirationDate: coupon.expirationDate,
    };

    if (req.body.courseId) {
      validateUUID(req.body.courseId, 'courseId');
      const course = await prisma.course.findUnique({
        where: { id: req.body.courseId },
        select: { id: true, title: true, price: true, status: true, deletedAt: true },
      });

      if (!course || course.deletedAt || course.status !== 'published') {
        return next(new AppError('Course not found or not available.', 404, 'NOT_FOUND'));
      }

      const originalPrice = Number(course.price);
      const finalPrice = applyCouponDiscount(originalPrice, coupon.discount);

      preview = {
        ...preview,
        courseId: course.id,
        courseTitle: course.title,
        originalPrice,
        finalPrice,
        currency: 'MAD',
      };
    }

    res.status(200).json(successResponse(preview));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/coupons/:id/usage  (admin)
// Returns all payments that used this coupon
export const getCouponUsage = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'couponId');

    const coupon = await prisma.coupon.findUnique({
      where: { id: req.params.id },
    });

    if (!coupon) {
      return next(new AppError('Coupon not found.', 404, 'NOT_FOUND'));
    }

    const payments = await prisma.payment.findMany({
      where: { couponId: req.params.id },
      include: {
        enrollment: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      // Payment has no createdAt column; order most-recently-paid first (nulls last
      // for still-pending payments), matching the other payment listings' intent.
      orderBy: { paidAt: { sort: 'desc', nulls: 'last' } },
    });

    res.status(200).json(successResponse({ payments }));
  } catch (error) {
    next(error);
  }
};
