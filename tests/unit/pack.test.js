import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computePackPricing,
  computeRevenueSplit,
  PLATFORM_COMMISSION_PCT,
} from '../../src/controllers/pack.controller.js';

describe('computePackPricing — early-bird "5 premiers inscrits"', () => {
  const pack = { price: 549, launchPrice: 499, launchSeats: 5 };

  it('charges the launch price while launch seats remain', () => {
    assert.equal(computePackPricing(pack, 0).currentPrice, 499);
    assert.equal(computePackPricing(pack, 4).currentPrice, 499); // 5th buyer still launch
    assert.equal(computePackPricing(pack, 4).seatsLeft, 1);
  });

  it('charges the normal price once launch seats are gone', () => {
    assert.equal(computePackPricing(pack, 5).currentPrice, 549); // 6th buyer
    assert.equal(computePackPricing(pack, 5).seatsLeft, 0);
    assert.equal(computePackPricing(pack, 99).currentPrice, 549);
  });

  it('falls back to the normal price when no launch price is set', () => {
    const p = computePackPricing({ price: 649, launchPrice: null, launchSeats: 0 }, 0);
    assert.equal(p.currentPrice, 649);
    assert.equal(p.launchPrice, null);
    assert.equal(p.seatsLeft, 0);
  });
});

describe('computeRevenueSplit — 20% commission, equal split', () => {
  it('splits equally and takes the platform commission off each share', () => {
    // 499 across 2 courses → 249.50 each; 20% commission → 49.90; net 199.60
    const s = computeRevenueSplit(499, 2);
    assert.equal(s.grossEach, 249.5);
    assert.equal(s.commissionEach, 49.9);
    assert.equal(s.netEach, 199.6);
    assert.equal(s.commissionPct, PLATFORM_COMMISSION_PCT);
  });

  it('handles a single-course pack', () => {
    const s = computeRevenueSplit(600, 1);
    assert.equal(s.grossEach, 600);
    assert.equal(s.commissionEach, 120);
    assert.equal(s.netEach, 480);
  });

  it('never divides by zero', () => {
    const s = computeRevenueSplit(100, 0);
    assert.equal(s.grossEach, 100);
  });
});
