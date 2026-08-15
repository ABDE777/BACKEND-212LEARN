# Instructor Payout — Platform Analysis & Proposed Algorithm

> Status: **design proposal for approval**. No code is implemented yet. Once the
> defaults below are confirmed, the schema + endpoints in §7 can be built.

## 1. Why this document exists
212LEARN currently tracks **revenue** (the sum of `PAID` payments) but has **no
concept of what an instructor is owed or when they get paid**. There is no
earnings ledger, no commission split, and no payout schedule. Payments are also
not settled instantly: a student submits a proof (Wafacash receipt or bank
transfer relevé) and an **admin approves it manually**, so a payment can become
`PAID` on *any* day of the month — e.g. the 20th. This creates a timing problem:
which payout period does that money belong to, and when does the instructor
actually receive it? This document defines a deterministic, auditable answer.

## 2. How money flows today (facts from the codebase)
- **Course**: has a `price` (Decimal, MAD). Free = `price = 0`.
- **Enrollment**: one per `(userId, courseId)`; grants access. A free course
  creates an enrollment with a settled `0`-amount `PAID` payment.
- **Payment** lifecycle (`payments.status`):
  `PENDING → WAITING_VERIFICATION → PAID` (admin approves) or `→ REJECTED`;
  `→ REFUNDED` is defined but not yet used. Key fields: `amount` (the **actually
  collected** amount, already net of any coupon), `provider` (`wafacash` /
  `transfer` / `free`), `paidAt` (set the moment it becomes `PAID`), `couponId`.
- **Coupon**: percentage discount; the discount is applied **before** the
  payment is created, so `Payment.amount` is always the real collected sum.
- **Instructors of a course**: `CourseInstructor` (many-to-many). A course can
  have more than one instructor (e.g. a lead + a group formateur).
- **Revenue analytics**: `analytics.controller.js` already sums `Payment.amount`
  where `status = PAID` per month and per course — the raw material for payouts.

## 3. The core question: *when does a payment "count"?*
A payment has three candidate dates:
1. `enrolledAt` — when the student enrolled / started checkout.
2. `createdAt`/submission — when the proof was uploaded.
3. **`paidAt`** — when the admin **approved** it and the money is confirmed.

**Decision: attribute earnings by `paidAt`.** Rationale: an instructor should
only be paid for money that is *confirmed collected*. A proof submitted on the
18th but approved on the 21st is only real revenue on the 21st. `paidAt` is the
single moment the platform commits to the money, so it is the fair and
auditable attribution date.

### The "day 20" example (worked)
- Student pays for a 100 MAD course; admin approves on **Aug 20** → `paidAt = Aug 20`.
- The payment is attributed to the **August** earnings period.
- August closes on **Aug 31**. All August-`paidAt` payments are summed per
  instructor to produce that instructor's **August payout**.
- The payout is **disbursed on Sep 5** (a fixed offset after month close — see §5).
- A payment approved on **Sep 1** (even if the student submitted the proof on
  Aug 28) belongs to **September**, paid out on **Oct 5**. No money is ever lost
  or double-counted; it simply lands in the period where it was confirmed.

This makes "a student can pay on day 20" a non-issue: the day within the month
doesn't matter, only *which month `paidAt` falls in*.

## 4. Earnings formula (per PAID payment)
```
platformFee      = amount * PLATFORM_COMMISSION_PCT
instructorEarning = amount - platformFee            // = amount * (1 - PLATFORM_COMMISSION_PCT)
```
- **`amount` is already net of coupons**, so instructors are paid on the real
  collected sum (a 20%-off coupon reduces both the platform fee and the
  instructor earning proportionally — fair to both).
- **Free courses** (`amount = 0`) generate `0` earnings — no special-casing.
- **Multiple instructors on one course**: split `instructorEarning` **equally**
  by default (`earning / N`). A future `CourseInstructor.sharePct` column can
  make the split configurable without changing this formula.
- **Refunds**: a `REFUNDED` payment **reverses** its earning — a negative ledger
  entry dated at the refund time, so it nets out of the current period (see §6).

### Recommended defaults (adjustable — this is what needs your sign-off)
| Parameter | Default | Meaning |
|---|---|---|
| `PLATFORM_COMMISSION_PCT` | **0.20** (20%) | Platform keeps 20%, instructor gets 80%. |
| Attribution date | **`paidAt`** | Confirmed-money date. |
| Period | **Calendar month** | Payout aggregation window. |
| Settlement offset | **5th of next month** | When the month's payout is disbursed. |
| Minimum payout | **100 MAD** | Below this, carry the balance to next month. |
| Multi-instructor split | **Equal** | Overridable later via a share field. |

## 5. Payout lifecycle (proposed)
```
                 month closes            admin runs payout            admin marks paid
  [accruing] ─────────────────▶ [PENDING] ─────────────▶ [PROCESSING] ─────────────▶ [PAID]
   (paidAt in                    a Payout row is           (money being               (disbursed;
    the open month)              generated per             sent out-of-band)           reference stored)
                                 instructor for the
                                 closed month
```
- Earnings **accrue** continuously as payments are approved (a ledger row per
  payment, see §7).
- After a month closes, an admin action (**`POST /admin/payouts/run?period=YYYY-MM`**)
  aggregates each instructor's ledger for that period into one **`Payout`** row
  (status `PENDING`), applying the minimum-payout carry rule.
- The admin disburses out-of-band (bank transfer to the instructor) and marks
  the payout `PAID` with a reference/date. Disbursement itself stays manual —
  the platform computes and records, humans move the money (same trust model as
  the existing payment approval flow).

## 6. Edge cases & how they're handled
- **Refund after the payout was already paid**: the reversal lands as a negative
  ledger entry in the **current** open period, reducing the next payout (never
  claws back a disbursed one). If it would make a period negative, carry the
  negative balance forward.
- **Payment approved, then rejected/reversed same month**: nets to zero in the
  ledger before month close — never paid out.
- **Course deleted / instructor removed** after earning: the ledger entry is
  immutable (it references the payment, not the live course), so historical
  payouts stay correct.
- **Instructor added to a course later**: only shares in payments whose
  `paidAt` is **after** they were linked (attribution uses the instructor set at
  approval time, snapshotted into the ledger row).
- **Multi-currency**: out of scope — everything is MAD today.

## 7. Proposed data model & endpoints (to build after approval)
**Schema (sketch):**
```prisma
model EarningLedger {          // one immutable row per (payment, instructor)
  id            String   @id @default(uuid()) @db.Uuid
  paymentId     String   @db.Uuid
  instructorId  String   @db.Uuid
  courseId      String   @db.Uuid
  grossAmount   Decimal  @db.Decimal(10,2)   // this instructor's share of Payment.amount
  platformFee   Decimal  @db.Decimal(10,2)
  netAmount     Decimal  @db.Decimal(10,2)   // what the instructor earns (can be negative on refund)
  period        String   @db.VarChar(7)      // "YYYY-MM" from paidAt
  type          String   @db.VarChar(20)     // EARNING | REFUND_REVERSAL
  payoutId      String?  @db.Uuid            // set when swept into a Payout
  createdAt     DateTime @default(now())
}

model Payout {                 // one per (instructor, period) after month close
  id            String   @id @default(uuid()) @db.Uuid
  instructorId  String   @db.Uuid
  period        String   @db.VarChar(7)
  amount        Decimal  @db.Decimal(10,2)
  status        String   @db.VarChar(20)     // PENDING | PROCESSING | PAID | CARRIED
  reference     String?                       // bank ref when disbursed
  paidAt        DateTime?
  createdAt     DateTime @default(now())
  @@unique([instructorId, period])
}
```
**Write points**: when a payment transitions to `PAID` (in `wafacash`/`transfer`
verify) create the `EarningLedger` rows inside the same transaction that sets
`paidAt`; when `REFUNDED`, write reversal rows.

**Endpoints**:
- `GET /instructor/earnings` — the instructor's balance, current-period accrual,
  and payout history (drives an "Mes revenus" dashboard tab).
- `GET /admin/payouts?period=YYYY-MM` — all instructors' computed payouts.
- `POST /admin/payouts/run` — sweep a closed period's ledger into `Payout` rows.
- `PATCH /admin/payouts/:id` — mark `PAID` with a reference.

**Config**: `PLATFORM_COMMISSION_PCT` and the payout parameters live in the new
admin **Settings** store (Workstream 2), so they're editable without a deploy.

## 8. Open decisions for you
1. Commission percentage (default **20%**)?
2. Settlement offset — **5th of next month** ok, or a different date/cadence
   (bi-weekly, on-demand threshold)?
3. Minimum payout amount (default **100 MAD**)?
4. Multi-instructor split — **equal** now, configurable share later?

Once these are confirmed, the schema + endpoints in §7 and the "Mes revenus"
instructor tab can be implemented.
