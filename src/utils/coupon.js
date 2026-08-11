import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

/**
 * Resolve a coupon by code and ensure it is still valid.
 * @param {string} code
 * @returns {Promise<{ id: string, code: string, discount: number, expirationDate: Date }>}
 */
export const resolveValidCoupon = async (code) => {
  if (!code || typeof code !== 'string' || !code.trim()) {
    throw new AppError('Coupon code is required.', 400, 'VALIDATION_ERROR');
  }

  const coupon = await prisma.coupon.findUnique({
    where: { code: code.trim().toUpperCase() },
  });

  if (!coupon) {
    throw new AppError(`Coupon code "${code}" is invalid.`, 400, 'VALIDATION_ERROR');
  }

  if (!coupon.isActive) {
    throw new AppError(`Coupon code "${code}" is inactive.`, 400, 'VALIDATION_ERROR');
  }

  if (new Date(coupon.expirationDate) < new Date()) {
    throw new AppError(`Coupon code "${code}" has expired.`, 400, 'VALIDATION_ERROR');
  }

  if (coupon.currentUsage >= coupon.maxUsage) {
    throw new AppError(`Coupon code "${code}" has reached its maximum usage limit.`, 400, 'VALIDATION_ERROR');
  }

  return {
    id: coupon.id,
    code: coupon.code,
    discount: Number(coupon.discount),
    expirationDate: coupon.expirationDate,
    maxUsage: coupon.maxUsage,
    currentUsage: coupon.currentUsage,
  };
};

/**
 * Apply a percent discount to a price.
 * Coupon.discount is stored as a percentage (e.g. 20 = 20% off).
 */
export const applyCouponDiscount = (price, discountPercent) => {
  const base = Number(price);
  const discount = Number(discountPercent);
  if (!Number.isFinite(base) || base < 0) {
    throw new AppError('Invalid price.', 400, 'VALIDATION_ERROR');
  }
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new AppError('Discount must be between 0 and 100.', 400, 'VALIDATION_ERROR');
  }
  const finalPrice = base * (1 - discount / 100);
  return Math.round(finalPrice * 100) / 100;
};
