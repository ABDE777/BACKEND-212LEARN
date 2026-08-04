import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from './error.js';
import { getJwtSecret } from '../config/jwt.js';
import { ensureCourseManager } from '../utils/authorization.js';

/**
 * Optional authentication middleware.
 * If a valid JWT token is provided, it extracts the user and attaches it to req.user.
 * If no token is provided, or if the token is invalid/expired, it silently passes through
 * without setting req.user. Used for previewing public curricula.
 */
export const optionalProtect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next();
    }

    const decoded = jwt.verify(token, getJwtSecret());

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (currentUser && !currentUser.deletedAt) {
      req.user = currentUser;
    }

    next();
  } catch (error) {
    // Fail silently on token errors to allow guests to browse public curriculum preview
    next();
  }
};

/**
 * Resolve courseId from common path params used by content routes.
 */
async function resolveCourseId(params) {
  if (params.courseId) return params.courseId;

  if (params.lessonId) {
    const lesson = await prisma.lesson.findUnique({
      where: { id: params.lessonId },
      include: { section: true },
    });
    if (!lesson) throw new AppError('Lesson not found.', 404, 'NOT_FOUND');
    return lesson.section.courseId;
  }

  if (params.assignmentId) {
    const assignment = await prisma.assignment.findUnique({
      where: { id: params.assignmentId },
      include: { lesson: { include: { section: true } } },
    });
    if (!assignment) throw new AppError('Assignment not found.', 404, 'NOT_FOUND');
    return assignment.lesson.section.courseId;
  }

  if (params.quizId) {
    const quiz = await prisma.quiz.findUnique({
      where: { id: params.quizId },
      include: { lesson: { include: { section: true } } },
    });
    if (!quiz) throw new AppError('Quiz not found.', 404, 'NOT_FOUND');
    return quiz.lesson.section.courseId;
  }

  return null;
}

/**
 * Enrollment verification middleware.
 * Students need PAID enrollment. Admins bypass. Instructors only for assigned courses.
 */
export const checkEnrollment = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new AppError('You must be logged in to access this content.', 401));
    }

    if (user.role === 'admin') {
      return next();
    }

    const courseId = await resolveCourseId(req.params);
    if (!courseId) {
      return next(new AppError('Course context could not be determined.', 400, 'BAD_REQUEST'));
    }

    // Instructors: only courses they manage
    if (user.role === 'instructor') {
      await ensureCourseManager(user, courseId);
      return next();
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: { userId: user.id, courseId },
      },
      include: { payment: true },
    });

    if (!enrollment || enrollment.payment?.status !== 'PAID') {
      return next(
        new AppError(
          'Access denied. You must be enrolled with a validated payment to view this content.',
          403,
          'FORBIDDEN'
        )
      );
    }

    req.enrollment = enrollment;
    next();
  } catch (error) {
    next(error);
  }
};
