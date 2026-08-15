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
import { validateUUID, validateRequired, validateEnum, validateHttpUrl } from '../utils/validation.js';
import { getJwtSecret } from '../config/jwt.js';

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
      getJwtSecret()
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
    // Admins can see all statuses (published, draft, archived) by default or filter explicitly.
    // Instructors can see all their own courses when requesting with instructorId=me or their own ID.
    // Guests and non-admin users default to seeing only 'published' courses.
    let targetStatus;
    if (status) {
      if (status === 'all') {
        if (currentUser && currentUser.role === 'admin') {
          targetStatus = null; // No status filter for admin -> returns published, draft, archived
        } else if (currentUser && currentUser.role === 'instructor' && targetInstructorId === currentUser.id) {
          targetStatus = null; // Instructors can see all their own courses
        } else {
          targetStatus = 'published';
        }
      } else if (status !== 'published') {
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
    } else {
      // If no status query parameter is explicitly provided:
      if (currentUser && currentUser.role === 'admin') {
        targetStatus = null; // Return all non-deleted courses for admin
      } else if (currentUser && currentUser.role === 'instructor' && targetInstructorId === currentUser.id) {
        targetStatus = null; // Instructors can see all their own courses by default
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
    validateUUID(req.params.id, 'courseId');

    const currentUser = await resolveSoftAuthUser(req);
    
    // Determine if user can view unpublished content
    const canViewUnpublished = await canViewUnpublishedCourse(currentUser, req.params.id);
    
    const includeDetails = canViewUnpublished;
    
    // Fetch groups linked to this course to get their formateurs
    const groups = await prisma.group.findMany({
      where: { courseId: req.params.id },
      include: {
        formateur: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
            bio: true,
          },
        },
      },
    });

    // Extract unique formateurs from groups
    const groupFormateurs = groups
      .map(g => g.formateur)
      .filter(f => f !== null)
      .filter((f, index, self) => index === self.findIndex(f2 => f2.id === f.id));

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
              },
            },
          },
        },
        _count: {
          select: { enrollments: true, reviews: true },
        },
      },
    });

    if (!course) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Merge course instructors with group formateurs
    const allInstructors = [...course.instructors];
    
    // Add group formateurs as instructors if they're not already in the list
    for (const formateur of groupFormateurs) {
      const alreadyExists = allInstructors.some(
        instructor => instructor.user.id === formateur.id
      );
      if (!alreadyExists) {
        allInstructors.push({
          user: formateur,
          isGroupInstructor: true,
        });
      }
    }

    course.instructors = allInstructors;

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
      thumbnail,
      instructorId,
    } = req.body;

    validateRequired(req.body, ['title', 'categoryId']);
    validateUUID(categoryId, 'categoryId');
    
    console.log('Creating course with categoryId:', categoryId);
    
    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: categoryId },
    });
    console.log('Found category:', category);
    if (!category || category.deletedAt) {
      return next(new AppError('Category not found.', 404, 'NOT_FOUND'));
    }
    
    if (instructorId) {
      validateUUID(instructorId, 'instructorId');
    }
    
    if (status) {
      validateEnum(status, ['draft', 'published', 'archived'], 'status');
    }
    
    if (level) {
      validateEnum(level, ['beginner', 'intermediate', 'advanced'], 'level');
    }

    if (thumbnail) {
      validateHttpUrl(thumbnail, 'thumbnail');
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
        price: price !== undefined ? price : 0,
        level,
        language,
        duration,
        status: status || 'draft',
        thumbnail: thumbnail || null,
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
    validateUUID(req.params.id, 'courseId');

    const {
      title,
      description,
      price,
      level,
      language,
      duration,
      status,
      thumbnail,
      categoryId,
      instructorId,
    } = req.body;

    if (categoryId) {
      validateUUID(categoryId, 'categoryId');
    }
    
    if (instructorId) {
      validateUUID(instructorId, 'instructorId');
    }
    
    if (status) {
      validateEnum(status, ['draft', 'published', 'archived'], 'status');
    }
    
    if (level) {
      validateEnum(level, ['beginner', 'intermediate', 'advanced'], 'level');
    }

    if (thumbnail) {
      validateHttpUrl(thumbnail, 'thumbnail');
    }

    await ensureCourseManager(req.user, req.params.id);

    const updateData = {
      ...(title && { title }),
      ...(description && { description }),
      ...(price !== undefined && { price }),
      ...(level && { level }),
      ...(language && { language }),
      ...(duration !== undefined && { duration }),
      ...(status && { status }),
      ...(thumbnail !== undefined && { thumbnail }),
      ...(categoryId && { categoryId }),
    };

    // Status gate for instructors: they may only edit a course's details while
    // it is a DRAFT. A published course must go through an update request
    // (admin review); an archived course is read-only. Admins may edit any
    // status directly. Instructors also can't flip status here (publish/archive
    // is admin-only).
    if (req.user.role !== 'admin') {
      const existing = await prisma.course.findUnique({
        where: { id: req.params.id },
        select: { status: true, deletedAt: true },
      });
      if (!existing || existing.deletedAt) {
        return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
      }
      if (existing.status === 'published') {
        return next(new AppError(
          'Published courses cannot be edited directly. Submit an update request for admin review.',
          403, 'UPDATE_VIA_REQUEST'
        ));
      }
      if (existing.status === 'archived') {
        return next(new AppError('Archived courses cannot be edited.', 403, 'FORBIDDEN'));
      }
      delete updateData.status;
    }

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
    validateUUID(req.params.id, 'courseId');

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
    validateUUID(req.params.id, 'courseId');

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

// GET /api/v1/courses/:id/students  (Instructor / Admin)
export const getCourseStudents = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'courseId');

    await ensureCourseManager(req.user, req.params.id);

    const { page, limit, skip, isUnlimited } = parsePagination(req.query);

    const where = {
      courseId: req.params.id,
    };

    const [total, enrollments] = await Promise.all([
      prisma.enrollment.count({ where }),
      prisma.enrollment.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              avatar: true,
              isVerified: true,
            },
          },
          payment: {
            select: {
              status: true,
              amount: true,
              paidAt: true,
            },
          },
        },
        orderBy: { enrolledAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    const students = enrollments.map((enrollment) => ({
      id: enrollment.user.id,
      firstName: enrollment.user.firstName,
      lastName: enrollment.user.lastName,
      email: enrollment.user.email,
      avatar: enrollment.user.avatar,
      isVerified: enrollment.user.isVerified,
      enrolledAt: enrollment.enrolledAt,
      paymentStatus: enrollment.payment?.status,
      paymentAmount: enrollment.payment?.amount,
      paidAt: enrollment.payment?.paidAt,
    }));

    res
      .status(200)
      .json(
        successResponse(
          { students },
          paginationMeta(total, page, limit, isUnlimited)
        )
      );
  } catch (error) {
    next(error);
  }
};
