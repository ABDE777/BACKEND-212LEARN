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
 * Atomically consume one use of a coupon, enforcing its maxUsage limit.
 *
 * The increment and the limit check happen in a SINGLE SQL statement
 * (`SET currentUsage = currentUsage + 1 WHERE currentUsage < maxUsage`), so there
 * is no check-then-act race: concurrent redemptions can never push currentUsage
 * past maxUsage. Prisma's updateMany can't compare two columns, hence the raw
 * statement. Call this at the moment a payment becomes PAID, inside that payment's
 * transaction, so a rollback also rolls back the usage.
 *
 * @param {import('@prisma/client').Prisma.TransactionClient} tx  active transaction client
 * @param {string} couponId  UUID of the coupon to consume
 * @throws {AppError} 400 if the coupon has already reached its maximum usage
 */
export const consumeCouponUsage = async (tx, couponId) => {
  if (!couponId) return;
  const affected = await tx.$executeRaw`
    UPDATE "coupons"
    SET "currentUsage" = "currentUsage" + 1
    WHERE "id" = ${couponId}::uuid AND "currentUsage" < "maxUsage"
  `;
  if (affected === 0) {
    throw new AppError('This coupon has reached its maximum usage limit.', 400, 'VALIDATION_ERROR');
  }
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
