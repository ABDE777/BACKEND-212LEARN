import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';

const SORTABLE_FIELDS = ['createdAt', 'title', 'price', 'duration'];

// GET /api/v1/courses?page=1&limit=20&categoryId=...&level=...&language=...&sort=price&order=asc&search=react
export const getAllCourses = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { categoryId, level, language, status, search } = req.query;

    const where = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(level && { level }),
      ...(language && { language }),
      ...(status ? { status } : { status: 'published' }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
    };

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
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
        orderBy,
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json(successResponse({ courses }, paginationMeta(total, page, limit)));
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
          include: { lessons: { orderBy: { position: 'asc' } } },
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
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    res.status(200).json(successResponse({ course }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/courses
export const createCourse = async (req, res, next) => {
  try {
    const { title, description, categoryId, price, level, language, duration, status } = req.body;

    if (!title || !categoryId || price === undefined) {
      return next(new AppError('title, categoryId and price are required.', 400, 'VALIDATION_ERROR'));
    }

    const course = await prisma.course.create({
      data: {
        title, description, categoryId, price, level, language, duration,
        status: status || 'draft',
        instructors: { create: { userId: req.user.id, role: 'owner' } },
      },
    });

    res.status(201).json(successResponse({ course }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/courses/:id
export const updateCourse = async (req, res, next) => {
  try {
    const { title, description, price, level, language, duration, status, categoryId } = req.body;

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: {
        ...(title       && { title }),
        ...(description && { description }),
        ...(price !== undefined && { price }),
        ...(level       && { level }),
        ...(language    && { language }),
        ...(duration !== undefined && { duration }),
        ...(status      && { status }),
        ...(categoryId  && { categoryId }),
      },
    });

    res.status(200).json(successResponse({ course }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/courses/:id  →  soft-delete, 204 No Content
export const deleteCourse = async (req, res, next) => {
  try {
    await prisma.course.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/search?q=react&page=1&limit=10
export const searchCourses = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 2) {
      return next(new AppError('Search query must be at least 2 characters.', 400, 'VALIDATION_ERROR'));
    }

    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      deletedAt: null,
      status: 'published',
      OR: [
        { title:       { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    };

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { enrollments: true, reviews: true } },
        },
        skip,
        take: limit,
      }),
    ]);

    res.status(200).json(successResponse({ courses }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/courses/:id/publish  (Admin only)
export const publishCourse = async (req, res, next) => {
  try {
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    if (course.status === 'published') {
      return next(new AppError('Course is already published.', 409, 'CONFLICT'));
    }

    const updated = await prisma.course.update({
      where: { id: req.params.id },
      data: { status: 'published' },
    });

    res.status(200).json(successResponse({ course: updated }));
  } catch (error) {
    next(error);
  }
};

