import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

// GET /api/v1/courses
export const getAllCourses = async (req, res, next) => {
  try {
    const { categoryId, level, language, status, search } = req.query;

    const where = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(level && { level }),
      ...(language && { language }),
      ...(status ? { status } : { status: 'published' }),
      ...(search && {
        title: { contains: search, mode: 'insensitive' },
      }),
    };

    const courses = await prisma.course.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        instructors: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
        _count: { select: { enrollments: true, reviews: true, sections: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      results: courses.length,
      data: { courses },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/:id
export const getCourse = async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        instructors: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true, bio: true } },
          },
        },
        sections: {
          orderBy: { position: 'asc' },
          include: {
            lessons: { orderBy: { position: 'asc' } },
          },
        },
        reviews: {
          take: 10,
          orderBy: { reviewDate: 'desc' },
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatar: true } },
          },
        },
        _count: { select: { enrollments: true, reviews: true } },
      },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('No course found with that ID.', 404));
    }

    res.status(200).json({ status: 'success', data: { course } });
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/courses (instructor/admin)
export const createCourse = async (req, res, next) => {
  try {
    const { title, description, categoryId, price, level, language, duration, status } = req.body;

    if (!title || !categoryId || price === undefined) {
      return next(new AppError('Please provide title, categoryId and price.', 400));
    }

    const course = await prisma.course.create({
      data: {
        title,
        description,
        categoryId,
        price,
        level,
        language,
        duration,
        status: status || 'draft',
        // Automatically add creator as instructor
        instructors: {
          create: { userId: req.user.id, role: 'owner' },
        },
      },
    });

    res.status(201).json({ status: 'success', data: { course } });
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/courses/:id (instructor/admin)
export const updateCourse = async (req, res, next) => {
  try {
    const { title, description, price, level, language, duration, status, categoryId } = req.body;

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...(title && { title }),
        ...(description && { description }),
        ...(price !== undefined && { price }),
        ...(level && { level }),
        ...(language && { language }),
        ...(duration !== undefined && { duration }),
        ...(status && { status }),
        ...(categoryId && { categoryId }),
        updatedAt: new Date(),
      },
    });

    res.status(200).json({ status: 'success', data: { course } });
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/courses/:id (admin, soft-delete)
export const deleteCourse = async (req, res, next) => {
  try {
    await prisma.course.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).json({ status: 'success', data: null });
  } catch (error) {
    next(error);
  }
};
