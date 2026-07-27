import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import {
  successResponse,
  paginationMeta,
  parsePagination,
  parseSort,
} from '../utils/response.js';
import { ensureCourseManager } from '../utils/authorization.js';

const SORTABLE_FIELDS = ['createdAt', 'title', 'price', 'duration'];

const resolveSoftAuthUser = async (req) => {
  if (
    !req.headers.authorization ||
    !req.headers.authorization.startsWith('Bearer')
  ) {
    return null;
  }

  try {
    const token = req.headers.authorization.split(' ')[1];
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || 'dev-secret-key-212learn'
    );
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    return user && !user.deletedAt ? user : null;
  } catch {
    return null;
  }
};

const canViewUnpublishedCourse = async (user, courseId) => {
  if (!user) {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  if (user.role !== 'instructor') {
    return false;
  }

  const instructor = await prisma.courseInstructor.findFirst({
    where: {
      courseId,
      userId: user.id,
    },
    select: { id: true },
  });

  return !!instructor;
};

// GET /api/v1/courses?page=1&limit=20&categoryId=...&level=...&language=...&sort=price&order=asc&search=react
export const getAllCourses = async (req, res, next) => {
  try {
    const { page, limit, skip, isUnlimited } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { categoryId, level, language, status, search, instructorId } =
      req.query;

    // ── Soft authentication for catalog filters ─────────────────────────────
    const currentUser = await resolveSoftAuthUser(req);

    // Resolve 'me' instructor alias
    let targetInstructorId = instructorId;
    if (instructorId === 'me') {
      if (!currentUser) {
        return next(
          new AppError(
            'Authentication required to use instructorId=me.',
            401,
            'UNAUTHORIZED'
          )
        );
      }
      targetInstructorId = currentUser.id;
    }

    // Resolve course visibility status:
    // Only course instructors or admins can see 'draft' / non-published statuses.
    let targetStatus = 'published';
    if (status) {
      if (status !== 'published') {
        const isAuthorized =
          currentUser &&
          (currentUser.role === 'admin' ||
            (targetInstructorId === currentUser.id &&
              currentUser.role === 'instructor'));

        if (!isAuthorized) {
          return next(
            new AppError(
              'You do not have permission to view non-published courses.',
              403,
              'FORBIDDEN'
            )
          );
        }
        targetStatus = status;
      } else {
        targetStatus = 'published';
      }
    }

    const where = {
      deletedAt: null,
      ...(categoryId && { categoryId }),
      ...(level && { level }),
      ...(language && { language }),
      ...(targetStatus && { status: targetStatus }),
      ...(search && { title: { contains: search, mode: 'insensitive' } }),
      ...(targetInstructorId && {
        instructors: {
          some: {
            userId: targetInstructorId,
          },
        },
      }),
    };

    const [total, courses] = await Promise.all([
      prisma.course.count({ where }),
      prisma.course.findMany({
        where,
        include: {
          category: { select: { id: true, name: true } },
          instructors: {
            include: {
              user: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  avatar: true,
                },
              },
            },
          },
          _count: {
            select: { enrollments: true, reviews: true, sections: true },
          },
        },
        orderBy,
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    res
      .status(200)
      .json(
        successResponse(
          { courses },
          paginationMeta(total, page, limit, isUnlimited)
        )
      );
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/:id
export const getCourse = async (req, res, next) => {
  try {
    const currentUser = await resolveSoftAuthUser(req);
    
    // Determine if user can view unpublished content
    const canViewUnpublished = await canViewUnpublishedCourse(currentUser, req.params.id);
    
    const includeDetails = canViewUnpublished;
    
    const course = await prisma.course.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        instructors: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
                ...(includeDetails && { bio: true }),
              },
            },
          },
        },
        ...(includeDetails && {
          sections: {
            orderBy: { position: 'asc' },
            include: { lessons: { orderBy: { position: 'asc' } } },
          },
        }),
        reviews: {
          take: 10,
          orderBy: { reviewDate: 'desc' },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
        },
        _count: { select: { enrollments: true, reviews: true, ...(includeDetails && { sections: true }) } },
      },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    if (course.status !== 'published' && !canViewUnpublished) {
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
    const {
      title,
      description,
      categoryId,
      price,
      level,
      language,
      duration,
      status,
      instructorId,
    } = req.body;

    if (!title || !categoryId || price === undefined) {
      return next(
        new AppError(
          'title, categoryId and price are required.',
          400,
          'VALIDATION_ERROR'
        )
      );
    }

    // Determine instructor ID: use provided instructorId or default to current user
    const targetInstructorId = instructorId || req.user.id;

    // Validate that the target instructor exists and has instructor role
    if (targetInstructorId !== req.user.id && req.user.role !== 'admin') {
      const targetUser = await prisma.user.findUnique({
        where: { id: targetInstructorId },
      });

      if (!targetUser || targetUser.deletedAt) {
        return next(new AppError('Instructor not found.', 404, 'NOT_FOUND'));
      }

      if (targetUser.role !== 'instructor') {
        return next(
          new AppError('The specified user must have the instructor role.', 400, 'BAD_REQUEST')
        );
      }
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
        instructors: {
          create: { userId: targetInstructorId, role: 'lead_instructor' },
        },
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
    const {
      title,
      description,
      price,
      level,
      language,
      duration,
      status,
      categoryId,
      instructorId,
    } = req.body;

    await ensureCourseManager(req.user, req.params.id);

    const updateData = {
      ...(title && { title }),
      ...(description && { description }),
      ...(price !== undefined && { price }),
      ...(level && { level }),
      ...(language && { language }),
      ...(duration !== undefined && { duration }),
      ...(status && { status }),
      ...(categoryId && { categoryId }),
    };

    // Handle instructor change if provided
    if (instructorId) {
      // Validate that the target instructor exists and has instructor role
      if (instructorId !== req.user.id && req.user.role !== 'admin') {
        const targetUser = await prisma.user.findUnique({
          where: { id: instructorId },
        });

        if (!targetUser || targetUser.deletedAt) {
          return next(new AppError('Instructor not found.', 404, 'NOT_FOUND'));
        }

        if (targetUser.role !== 'instructor') {
          return next(
            new AppError('The specified user must have the instructor role.', 400, 'BAD_REQUEST')
          );
        }
      }

      // Remove existing lead instructor and add new one
      await prisma.courseInstructor.deleteMany({
        where: {
          courseId: req.params.id,
          role: 'lead_instructor',
        },
      });

      await prisma.courseInstructor.create({
        data: {
          courseId: req.params.id,
          userId: instructorId,
          role: 'lead_instructor',
        },
      });
    }

    const course = await prisma.course.update({
      where: { id: req.params.id },
      data: updateData,
    });

    res.status(200).json(successResponse({ course }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/courses/:id  →  soft-delete, 204 No Content
export const deleteCourse = async (req, res, next) => {
  try {
    await ensureCourseManager(req.user, req.params.id);

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
      return next(
        new AppError(
          'Search query must be at least 2 characters.',
          400,
          'VALIDATION_ERROR'
        )
      );
    }

    const { page, limit, skip, isUnlimited } = parsePagination(req.query);

    const where = {
      deletedAt: null,
      status: 'published',
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
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
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    res
      .status(200)
      .json(
        successResponse(
          { courses },
          paginationMeta(total, page, limit, isUnlimited)
        )
      );
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
      return next(
        new AppError('Course is already published.', 409, 'CONFLICT')
      );
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
