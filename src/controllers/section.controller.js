import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

// ─── GET /courses/:courseId/curriculum ───────────────────────────────────────
// Returns the full section → lesson tree for a course.
// Public for published courses; instructors/admins can view any status.
export const getCurriculum = async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Non-admin/instructor can only view published courses
    const isPrivileged =
      req.user && (req.user.role === 'admin' || req.user.role === 'instructor');

    if (course.status !== 'published' && !isPrivileged) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    const sections = await prisma.section.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          orderBy: { position: 'asc' },
          include: {
            resources: true,
          },
        },
      },
    });

    res.status(200).json(successResponse({ courseId: req.params.courseId, sections }));
  } catch (error) {
    next(error);
  }
};

// ─── POST /courses/:courseId/sections ────────────────────────────────────────
export const createSection = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return next(new AppError('Section title is required.', 400, 'VALIDATION_ERROR'));
    }

    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Auto-assign position: last section + 1
    const lastSection = await prisma.section.findFirst({
      where: { courseId: req.params.courseId },
      orderBy: { position: 'desc' },
    });
    const position = lastSection ? lastSection.position + 1 : 1;

    const section = await prisma.section.create({
      data: {
        courseId: req.params.courseId,
        title:    title.trim(),
        position,
      },
    });

    res.status(201).json(successResponse({ section }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /sections/:id ──────────────────────────────────────────────────────
export const updateSection = async (req, res, next) => {
  try {
    const { title, position } = req.body;

    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
    });

    if (!section) {
      return next(new AppError('Section not found.', 404, 'NOT_FOUND'));
    }

    const updated = await prisma.section.update({
      where: { id: req.params.id },
      data: {
        ...(title    !== undefined && { title: title.trim() }),
        ...(position !== undefined && { position: Number(position) }),
      },
    });

    res.status(200).json(successResponse({ section: updated }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /sections/:id ────────────────────────────────────────────────────
// Cascades to lessons → resources (handled by Prisma schema onDelete: Cascade)
export const deleteSection = async (req, res, next) => {
  try {
    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
    });

    if (!section) {
      return next(new AppError('Section not found.', 404, 'NOT_FOUND'));
    }

    await prisma.section.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
