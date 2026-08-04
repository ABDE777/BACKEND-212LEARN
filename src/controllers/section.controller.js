import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { ensureCourseManager } from '../utils/authorization.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

// ─── GET /courses/:courseId/curriculum ───────────────────────────────────────
// Returns the full section → lesson tree for a course.
// Public preview: resource URLs are REDACTED for unenrolled users.
// Full access: admins, instructors, and enrolled students see everything.
export const getCurriculum = async (req, res, next) => {
  try {
    validateUUID(req.params.courseId, 'courseId');

    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Admins always privileged; instructors only for courses they manage
    let isPrivileged = req.user?.role === 'admin';
    if (!isPrivileged && req.user?.role === 'instructor') {
      const assignment = await prisma.courseInstructor.findFirst({
        where: { userId: req.user.id, courseId: req.params.courseId },
        select: { id: true },
      });
      isPrivileged = Boolean(assignment);
    }

    if (course.status !== 'published' && !isPrivileged) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Check if the requesting user is an enrolled student with a validated paid status
    let isEnrolled = false;
    if (req.user && req.user.role === 'student') {
      const enrollment = await prisma.enrollment.findUnique({
        where: {
          userId_courseId: {
            userId: req.user.id,
            courseId: req.params.courseId,
          },
        },
        include: { payment: true },
      });
      isEnrolled = enrollment?.payment?.status === 'PAID';
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

    // Redact resource URLs for users without full access (guests + unenrolled students)
    const hasFullAccess = isPrivileged || isEnrolled;
    const sanitizedSections = hasFullAccess
      ? sections
      : sections.map((section) => ({
          ...section,
          lessons: section.lessons.map((lesson) => ({
            ...lesson,
            resources: lesson.resources.map((resource) =>
              resource.type === 'link'
                ? resource // External links can be previewed
                : { ...resource, url: 'ENROLLMENT_REQUIRED' }
            ),
          })),
        }));

    res.status(200).json(
      successResponse({
        courseId:  req.params.courseId,
        sections:  sanitizedSections,
        hasFullAccess,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── POST /courses/:courseId/sections ────────────────────────────────────────
export const createSection = async (req, res, next) => {
  try {
    validateUUID(req.params.courseId, 'courseId');
    validateRequired(req.body, ['title']);

    const { title } = req.body;

    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, req.params.courseId);

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
    validateUUID(req.params.id, 'sectionId');

    const { title, position } = req.body;

    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
    });

    if (!section) {
      return next(new AppError('Section not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, section.courseId);

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
    validateUUID(req.params.id, 'sectionId');

    const section = await prisma.section.findUnique({
      where: { id: req.params.id },
    });

    if (!section) {
      return next(new AppError('Section not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, section.courseId);

    await prisma.section.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
