import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';

// ─── POST /sections/:sectionId/lessons ───────────────────────────────────────
export const createLesson = async (req, res, next) => {
  try {
    const { title } = req.body;

    if (!title || !title.trim()) {
      return next(new AppError('Lesson title is required.', 400, 'VALIDATION_ERROR'));
    }

    const section = await prisma.section.findUnique({
      where: { id: req.params.sectionId },
    });

    if (!section) {
      return next(new AppError('Section not found.', 404, 'NOT_FOUND'));
    }

    // Auto-assign position: last lesson in section + 1
    const lastLesson = await prisma.lesson.findFirst({
      where: { sectionId: req.params.sectionId },
      orderBy: { position: 'desc' },
    });
    const position = lastLesson ? lastLesson.position + 1 : 1;

    const lesson = await prisma.lesson.create({
      data: {
        sectionId: req.params.sectionId,
        title:     title.trim(),
        position,
      },
    });

    res.status(201).json(successResponse({ lesson }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /lessons/:id ───────────────────────────────────────────────────────
export const updateLesson = async (req, res, next) => {
  try {
    const { title, position } = req.body;

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
    });

    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    const updated = await prisma.lesson.update({
      where: { id: req.params.id },
      data: {
        ...(title    !== undefined && { title: title.trim() }),
        ...(position !== undefined && { position: Number(position) }),
      },
    });

    res.status(200).json(successResponse({ lesson: updated }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /lessons/:id ──────────────────────────────────────────────────────
// Cascades to resources, assignments, quizzes, lessonProgress (via Prisma schema)
export const deleteLesson = async (req, res, next) => {
  try {
    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.id },
    });

    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    await prisma.lesson.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
