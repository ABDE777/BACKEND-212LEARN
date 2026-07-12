import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

// GET /api/v1/enrollments/my-courses
export const getMyCourses = async (req, res, next) => {
  try {
    const enrollments = await prisma.enrollment.findMany({
      where: { userId: req.user.id },
      include: {
        course: {
          include: {
            _count: { select: { sections: true, reviews: true } },
          },
        },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: enrollments.length,
      data: { enrollments },
    });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/enrollments (enroll in a course)
export const enrollInCourse = async (req, res, next) => {
  try {
    const { courseId } = req.body;

    if (!courseId) return next(new AppError('Please provide a courseId.', 400));

    // Check if already enrolled
    const existing = await prisma.enrollment.findFirst({
      where: { userId: req.user.id, courseId },
    });

    if (existing) {
      return next(new AppError('You are already enrolled in this course.', 409));
    }

    const enrollment = await prisma.enrollment.create({
      data: { userId: req.user.id, courseId },
      include: { course: { select: { id: true, title: true, price: true } } },
    });

    res.status(201).json({ status: 'success', data: { enrollment } });
  } catch (error) {
    next(error);
  }
};
