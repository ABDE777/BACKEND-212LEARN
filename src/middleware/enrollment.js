import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from './error.js';

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

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret-key-212learn');

    const currentUser = await prisma.user.findUnique({
      where: { id: decoded.id },
    });

    if (currentUser) {
      req.user = currentUser;
    }
    
    next();
  } catch (error) {
    // Fail silently on token errors to allow guests to browse public curriculum preview
    next();
  }
};

/**
 * Enrollment verification middleware.
 * Restricts access to students who are actively enrolled in the course.
 * Admins and instructors bypass this check.
 * Resolves the courseId dynamically from path parameters:
 *   - Direct: req.params.courseId
 *   - Via Lesson: req.params.lessonId
 *   - Via Assignment: req.params.assignmentId
 */
export const checkEnrollment = async (req, res, next) => {
  try {
    const user = req.user;
    if (!user) {
      return next(new AppError('You must be logged in to access this content.', 401));
    }

    // Admins and instructors have global access
    if (user.role === 'admin' || user.role === 'instructor') {
      return next();
    }

    let courseId = req.params.courseId;

    // Resolve courseId from lessonId if necessary
    if (!courseId && req.params.lessonId) {
      const lesson = await prisma.lesson.findUnique({
        where: { id: req.params.lessonId },
        include: {
          section: true,
        },
      });

      if (!lesson) {
        return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
      }
      courseId = lesson.section.courseId;
    }

    // Resolve courseId from assignmentId if necessary
    if (!courseId && req.params.assignmentId) {
      const assignment = await prisma.assignment.findUnique({
        where: { id: req.params.assignmentId },
        include: {
          lesson: {
            include: {
              section: true,
            },
          },
        },
      });

      if (!assignment) {
        return next(new AppError('Assignment not found.', 404, 'NOT_FOUND'));
      }
      courseId = assignment.lesson.section.courseId;
    }

    if (!courseId) {
      return next(new AppError('Course context could not be determined.', 400, 'BAD_REQUEST'));
    }

    // Verify active enrollment in the database with status = paid
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId:   user.id,
        courseId,
        payment: {
          status: 'PAID',
        },
      },
    });

    if (!enrollment) {
      return next(new AppError('Access denied. You must be enrolled with a validated payment to view this content.', 403, 'FORBIDDEN'));
    }

    next();
  } catch (error) {
    next(error);
  }
};
