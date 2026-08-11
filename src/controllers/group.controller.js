import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';

const SORTABLE_FIELDS = ['createdAt', 'name', 'updatedAt'];

// GET /api/v1/groups?page=1&limit=20
export const getAllGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { search, courseId, formateurId } = req.query;

    const where = {
      deletedAt: null,
      ...(courseId && { courseId }),
      ...(formateurId && { formateurId }),
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, groups] = await Promise.all([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        orderBy,
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
        include: {
          course: {
            select: { id: true, title: true },
          },
          formateur: {
            select: { id: true, firstName: true, lastName: true },
          },
          createdBy: {
            select: { id: true, firstName: true, lastName: true },
          },
          _count: {
            select: { students: true },
          },
        },
      }),
    ]);

    const groupsWithCount = groups.map(group => ({
      ...group,
      studentCount: group._count.students,
      _count: undefined,
    }));

    res.status(200).json(successResponse({ groups: groupsWithCount }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/groups/:id
export const getGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      include: {
        course: {
          select: { id: true, title: true },
        },
        formateur: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        createdBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        students: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
          },
        },
      },
    });

    if (!group) return next(new AppError('Group not found.', 404, 'NOT_FOUND'));

    res.status(200).json(successResponse({ group }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/groups
export const createGroup = async (req, res, next) => {
  try {
    validateRequired(req.body, ['name', 'formateurId']);
    validateUUID(req.body.formateurId, 'formateurId');

    const { name, description, courseId, formateurId } = req.body;

    // Verify formateur exists
    const formateur = await prisma.user.findUnique({
      where: { id: formateurId },
      select: { id: true, role: true },
    });

    if (!formateur) {
      return next(new AppError('Formateur not found.', 404, 'NOT_FOUND'));
    }

    if (formateur.role !== 'instructor' && formateur.role !== 'admin') {
      return next(new AppError('User must be an instructor or admin to be a formateur.', 400, 'VALIDATION_ERROR'));
    }

    // If courseId is provided, verify it exists
    if (courseId) {
      validateUUID(courseId, 'courseId');
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });

      if (!course) {
        return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
      }
    }

    const group = await prisma.group.create({
      data: {
        name,
        description,
        courseId,
        formateurId,
        createdById: req.user?.id,
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        formateur: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    res.status(201).json(successResponse({ group }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/groups/:id
export const updateGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
    });

    if (!group) return next(new AppError('Group not found.', 404, 'NOT_FOUND'));

    const { name, description, courseId, formateurId } = req.body;

    // If formateurId is being updated, verify it exists
    if (formateurId) {
      validateUUID(formateurId, 'formateurId');
      const formateur = await prisma.user.findUnique({
        where: { id: formateurId },
        select: { id: true, role: true },
      });

      if (!formateur) {
        return next(new AppError('Formateur not found.', 404, 'NOT_FOUND'));
      }

      if (formateur.role !== 'instructor' && formateur.role !== 'admin') {
        return next(new AppError('User must be an instructor or admin to be a formateur.', 400, 'VALIDATION_ERROR'));
      }
    }

    // If courseId is being updated, verify it exists
    if (courseId) {
      validateUUID(courseId, 'courseId');
      const course = await prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true },
      });

      if (!course) {
        return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
      }
    }

    const updatedGroup = await prisma.group.update({
      where: { id: req.params.id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(courseId !== undefined && { courseId }),
        ...(formateurId && { formateurId }),
      },
      include: {
        course: {
          select: { id: true, title: true },
        },
        formateur: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    res.status(200).json(successResponse({ group: updatedGroup }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/groups/:id
export const deleteGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
    });

    if (!group) return next(new AppError('Group not found.', 404, 'NOT_FOUND'));

    // Soft delete
    await prisma.group.update({
      where: { id: req.params.id },
      data: { deletedAt: new Date() },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/groups/:id/students
export const addStudentToGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');
    validateRequired(req.body, ['userId']);
    validateUUID(req.body.userId, 'userId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
    });

    if (!group) return next(new AppError('Group not found.', 404, 'NOT_FOUND'));

    const user = await prisma.user.findUnique({
      where: { id: req.body.userId },
      select: { id: true, role: true },
    });

    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));

    if (user.role !== 'student' && user.role !== 'employee') {
      return next(new AppError('User must be a student or employee to join a group.', 400, 'VALIDATION_ERROR'));
    }

    // Check if student is already in the group
    const existingMembership = await prisma.groupStudent.findUnique({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: req.body.userId,
        },
      },
    });

    if (existingMembership) {
      return next(new AppError('User is already in this group.', 400, 'VALIDATION_ERROR'));
    }

    await prisma.groupStudent.create({
      data: {
        groupId: req.params.id,
        userId: req.body.userId,
      },
    });

    res.status(201).json(successResponse({ message: 'Student added to group successfully.' }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/groups/:id/students/:userId
export const removeStudentFromGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');
    validateUUID(req.params.userId, 'userId');

    const membership = await prisma.groupStudent.findUnique({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: req.params.userId,
        },
      },
    });

    if (!membership) return next(new AppError('Student not found in this group.', 404, 'NOT_FOUND'));

    await prisma.groupStudent.delete({
      where: {
        groupId_userId: {
          groupId: req.params.id,
          userId: req.params.userId,
        },
      },
    });

    res.status(204).end();
  } catch (error) {
    next(error);
  }
};
