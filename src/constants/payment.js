// Single source of truth for the Payment.status free-text state machine, so the
// money-state transitions can't drift on a typo. Values are the exact strings
// stored in the `payments.status` column.
export const PAYMENT_STATUS = Object.freeze({
  PENDING: 'PENDING',
  WAITING_VERIFICATION: 'WAITING_VERIFICATION',
  PAID: 'PAID',
  REJECTED: 'REJECTED',
  REFUNDED: 'REFUNDED',
});

export const PAYMENT_PROVIDER = Object.freeze({
  WAFACASH: 'wafacash',
  TRANSFER: 'transfer',
  FREE: 'free',
});
