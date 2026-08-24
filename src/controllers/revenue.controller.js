import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID } from '../utils/validation.js';

const sumNet = (shares) => shares.reduce((acc, s) => acc + Number(s.netAmount), 0);

const summarize = (shares) => {
  const pending = shares.filter((s) => s.status === 'pending');
  const paidOut = shares.filter((s) => s.status === 'paid_out');
  return {
    currency: shares[0]?.currency || 'MAD',
    totalEarned: Math.round(sumNet(shares) * 100) / 100,
    pendingAmount: Math.round(sumNet(pending) * 100) / 100,
    paidOutAmount: Math.round(sumNet(paidOut) * 100) / 100,
    salesCount: shares.length,
  };
};

const shareInclude = {
  course: { select: { id: true, title: true } },
  packPurchase: { select: { id: true, transactionReference: true, createdAt: true, paidAt: true } },
};

// ─── GET /api/v1/instructor/earnings ─────────────────────────────────────────
// The logged-in instructor's pack revenue. Admins may pass ?instructorId=.
export const getInstructorEarnings = async (req, res, next) => {
  try {
    let instructorId = req.user.id;
    if (req.user.role === 'admin' && req.query.instructorId) {
      validateUUID(req.query.instructorId, 'instructorId');
      instructorId = req.query.instructorId;
    }

    const shares = await prisma.revenueShare.findMany({
      where: { instructorId },
      include: shareInclude,
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    res.status(200).json(successResponse({
      summary: summarize(shares),
      shares,
    }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/admin/revenue-shares (admin) ────────────────────────────────
// Payout report: every share, grouped per instructor, filterable by status.
export const getRevenueShares = async (req, res, next) => {
  try {
    const { status, instructorId } = req.query;
    const where = {};
    if (status === 'pending' || status === 'paid_out') where.status = status;
    if (instructorId) {
      validateUUID(instructorId, 'instructorId');
      where.instructorId = instructorId;
    }

    const shares = await prisma.revenueShare.findMany({
      where,
      include: {
        ...shareInclude,
        instructor: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    });

    // Group per instructor for a manual-payout view.
    const byInstructor = new Map();
    for (const s of shares) {
      const key = s.instructorId;
      if (!byInstructor.has(key)) {
        byInstructor.set(key, { instructor: s.instructor, shares: [] });
      }
      byInstructor.get(key).shares.push(s);
    }
    const instructors = [...byInstructor.values()].map((g) => ({
      instructor: g.instructor,
      summary: summarize(g.shares),
    }));

    res.status(200).json(successResponse({
      totals: summarize(shares),
      instructors,
      shares,
    }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/revenue-shares/payout (admin) ───────────────────────
// Mark shares as paid out (manual accounting). Pass shareIds[] or instructorId
// (to settle all that instructor's pending shares).
export const markSharesPaidOut = async (req, res, next) => {
  try {
    const { shareIds, instructorId } = req.body;

    let where;
    if (Array.isArray(shareIds) && shareIds.length > 0) {
      shareIds.forEach((id) => validateUUID(id, 'shareId'));
      where = { id: { in: shareIds }, status: 'pending' };
    } else if (instructorId) {
      validateUUID(instructorId, 'instructorId');
      where = { instructorId, status: 'pending' };
    } else {
      return next(new AppError('Fournissez shareIds[] ou instructorId.', 400, 'VALIDATION_ERROR'));
    }

    const result = await prisma.revenueShare.updateMany({
      where,
      data: { status: 'paid_out', paidOutAt: new Date() },
    });

    res.status(200).json(successResponse({
      updated: result.count,
      message: `${result.count} part(s) marquée(s) comme payée(s).`,
    }));
  } catch (error) {
    next(error);
  }
};
