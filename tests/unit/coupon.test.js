import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyCouponDiscount } from '../../src/utils/coupon.js';
import { AppError } from '../../src/middleware/error.js';
import { successResponse, paginationMeta, parsePagination } from '../../src/utils/response.js';

describe('applyCouponDiscount', () => {
  it('applies percent discount and rounds to 2 decimals', () => {
    assert.equal(applyCouponDiscount(100, 20), 80);
    assert.equal(applyCouponDiscount(199.99, 10), 179.99);
  });

  it('rejects invalid discount percents', () => {
    assert.throws(() => applyCouponDiscount(100, -1), AppError);
    assert.throws(() => applyCouponDiscount(100, 101), AppError);
  });

  it('rejects invalid prices', () => {
    assert.throws(() => applyCouponDiscount(-5, 10), AppError);
  });
});

describe('response helpers', () => {
  it('builds success envelope', () => {
    assert.deepEqual(successResponse({ ok: true }), {
      success: true,
      data: { ok: true },
    });
  });

  it('parses pagination and unlimited mode', () => {
    assert.deepEqual(parsePagination({ page: '2', limit: '10' }), {
      page: 2,
      limit: 10,
      skip: 10,
      isUnlimited: false,
    });
    assert.deepEqual(parsePagination({ limit: '-1' }), {
      page: 1,
      limit: null,
      skip: undefined,
      isUnlimited: true,
    });
  });

  it('builds pagination meta', () => {
    const meta = paginationMeta(45, 2, 20);
    assert.equal(meta.totalPages, 3);
    assert.equal(meta.hasNextPage, true);
    assert.equal(meta.hasPrevPage, true);
  });
});
