import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

// Platform commission applied to every course share (Phase 2 revenue split).
export const PLATFORM_COMMISSION_PCT = 20;

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Split a pack's paid amount equally across its courses, then take the platform
 * commission off each share. Returns the per-course figures owed to instructors.
 */
export const computeRevenueSplit = (amount, numCourses, commissionPct = PLATFORM_COMMISSION_PCT) => {
  const n = Math.max(1, Number(numCourses) || 1);
  const grossEach = round2(Number(amount) / n);
  const commissionEach = round2(grossEach * (commissionPct / 100));
  const netEach = round2(grossEach - commissionEach);
  return { grossEach, commissionEach, netEach, commissionPct };
};

/**
 * Resolve the effective price of a pack given how many have already bought it.
 * The first `launchSeats` buyers pay `launchPrice`; everyone after pays `price`.
 */
export const computePackPricing = (pack, soldCount = 0) => {
  const normal = Number(pack.price);
  const launch = pack.launchPrice != null ? Number(pack.launchPrice) : null;
  const seats = pack.launchSeats || 0;
  const seatsLeft = launch != null ? Math.max(0, seats - soldCount) : 0;
  const currentPrice = launch != null && seatsLeft > 0 ? launch : normal;
  return { normalPrice: normal, launchPrice: launch, launchSeats: seats, seatsLeft, currentPrice };
};

// A launch seat is reserved the moment a student initiates a purchase, and only
// released if that purchase is rejected — so count every non-rejected purchase.
export const soldCountForPack = async (packId) =>
  prisma.packPurchase.count({
    where: { packId, status: { in: ['PENDING', 'WAITING_VERIFICATION', 'PAID'] } },
  });

const packInclude = {
  courses: {
    include: {
      course: { select: { id: true, title: true, price: true, thumbnail: true, status: true } },
      instructor: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
    },
  },
};

/**
 * Validate the requested courses and resolve one instructor per course.
 * - The instructor must be one of the course's assigned instructors.
 * - If a course has exactly one instructor and none was given, auto-select it.
 * Returns [{ courseId, instructorId }].
 */
const resolvePackCourses = async (courses) => {
  if (!Array.isArray(courses) || courses.length === 0) {
    throw new AppError('Un pack doit contenir au moins un cours.', 400, 'VALIDATION_ERROR');
  }

  const resolved = [];
  const seen = new Set();

  for (const entry of courses) {
    const courseId = entry?.courseId;
    validateUUID(courseId, 'courseId');
    if (seen.has(courseId)) {
      throw new AppError('Un même cours ne peut pas figurer deux fois dans un pack.', 400, 'VALIDATION_ERROR');
    }
    seen.add(courseId);

    const course = await prisma.course.findFirst({
      where: { id: courseId, deletedAt: null },
      include: { instructors: { select: { userId: true } } },
    });
    if (!course) {
      throw new AppError(`Cours introuvable : ${courseId}.`, 404, 'NOT_FOUND');
    }

    const instructorIds = course.instructors.map((i) => i.userId);
    if (instructorIds.length === 0) {
      throw new AppError(`Le cours « ${course.title} » n'a aucun formateur assigné.`, 400, 'NO_INSTRUCTOR');
    }

    let instructorId = entry?.instructorId || null;
    if (instructorId) {
      validateUUID(instructorId, 'instructorId');
      if (!instructorIds.includes(instructorId)) {
        throw new AppError(`Le formateur choisi n'enseigne pas le cours « ${course.title} ».`, 400, 'INVALID_INSTRUCTOR');
      }
    } else if (instructorIds.length === 1) {
      instructorId = instructorIds[0]; // auto-select the only instructor
    } else {
      throw new AppError(`Le cours « ${course.title} » a plusieurs formateurs — sélectionnez-en un.`, 400, 'INSTRUCTOR_REQUIRED');
    }

    resolved.push({ courseId, instructorId });
  }

  return resolved;
};

const serializePack = (pack, soldCount = 0) => ({
  ...pack,
  pricing: computePackPricing(pack, soldCount),
});

// ─── POST /api/v1/packs (admin) ──────────────────────────────────────────────
export const createPack = async (req, res, next) => {
  try {
    validateRequired(req.body, ['title', 'price', 'courses']);
    const { title, description, thumbnail, price, launchPrice, launchSeats, currency, status, courses } = req.body;

    const normalPrice = Number(price);
    if (!Number.isFinite(normalPrice) || normalPrice < 0) {
      return next(new AppError('Prix invalide.', 400, 'VALIDATION_ERROR'));
    }
    let launch = null;
    if (launchPrice != null && launchPrice !== '') {
      launch = Number(launchPrice);
      if (!Number.isFinite(launch) || launch < 0) {
        return next(new AppError('Prix de lancement invalide.', 400, 'VALIDATION_ERROR'));
      }
    }
    const seats = launchSeats != null ? Math.max(0, parseInt(launchSeats, 10) || 0) : 0;

    const resolvedCourses = await resolvePackCourses(courses);

    const pack = await prisma.pack.create({
      data: {
        title: String(title).trim(),
        description: description ? String(description).trim() : null,
        thumbnail: thumbnail || null,
        price: normalPrice,
        launchPrice: launch,
        launchSeats: seats,
        currency: currency || 'MAD',
        status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft',
        courses: { create: resolvedCourses },
      },
      include: packInclude,
    });

    res.status(201).json(successResponse({ pack: serializePack(pack, 0) }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/packs/:id (admin) ─────────────────────────────────────────
export const updatePack = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'packId');
    const existing = await prisma.pack.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return next(new AppError('Pack introuvable.', 404, 'NOT_FOUND'));
    }

    const { title, description, thumbnail, price, launchPrice, launchSeats, currency, status, courses } = req.body;
    const data = {};
    if (title !== undefined) data.title = String(title).trim();
    if (description !== undefined) data.description = description ? String(description).trim() : null;
    if (thumbnail !== undefined) data.thumbnail = thumbnail || null;
    if (price !== undefined) data.price = Number(price);
    if (launchPrice !== undefined) data.launchPrice = (launchPrice === '' || launchPrice == null) ? null : Number(launchPrice);
    if (launchSeats !== undefined) data.launchSeats = Math.max(0, parseInt(launchSeats, 10) || 0);
    if (currency !== undefined) data.currency = currency || 'MAD';
    if (status !== undefined && ['draft', 'published', 'archived'].includes(status)) data.status = status;

    // Replacing the course/instructor set: revalidate and swap atomically.
    if (courses !== undefined) {
      const resolvedCourses = await resolvePackCourses(courses);
      await prisma.$transaction([
        prisma.packCourse.deleteMany({ where: { packId: existing.id } }),
        prisma.packCourse.createMany({ data: resolvedCourses.map((c) => ({ ...c, packId: existing.id })) }),
      ]);
    }

    const pack = await prisma.pack.update({ where: { id: existing.id }, data, include: packInclude });
    res.status(200).json(successResponse({ pack: serializePack(pack, await soldCountForPack(pack.id)) }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/v1/packs/:id (admin) — soft delete ──────────────────────────
export const deletePack = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'packId');
    const existing = await prisma.pack.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.deletedAt) {
      return next(new AppError('Pack introuvable.', 404, 'NOT_FOUND'));
    }
    await prisma.pack.update({ where: { id: existing.id }, data: { deletedAt: new Date(), status: 'archived' } });
    res.status(200).json(successResponse({ id: existing.id }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/packs — published for everyone, all for admins ──────────────
export const getPacks = async (req, res, next) => {
  try {
    const isAdmin = req.user?.role === 'admin';
    const packs = await prisma.pack.findMany({
      where: { deletedAt: null, ...(isAdmin ? {} : { status: 'published' }) },
      include: packInclude,
      orderBy: { createdAt: 'desc' },
    });
    const withPricing = await Promise.all(
      packs.map(async (p) => serializePack(p, await soldCountForPack(p.id))),
    );
    res.status(200).json(successResponse({ packs: withPricing }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/packs/:id ───────────────────────────────────────────────────
export const getPack = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'packId');
    const pack = await prisma.pack.findFirst({
      where: { id: req.params.id, deletedAt: null },
      include: packInclude,
    });
    if (!pack) return next(new AppError('Pack introuvable.', 404, 'NOT_FOUND'));
    if (pack.status !== 'published' && req.user?.role !== 'admin') {
      return next(new AppError('Pack introuvable.', 404, 'NOT_FOUND'));
    }
    res.status(200).json(successResponse({ pack: serializePack(pack, await soldCountForPack(pack.id)) }));
  } catch (error) {
    next(error);
  }
};
