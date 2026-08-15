import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';
import { validateUUID, validateRequired } from '../utils/validation.js';
import { linkFormateurToCourse } from '../utils/groupSync.js';
import { PAYMENT_STATUS } from '../constants/payment.js';

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

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
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
      // A course-bound group makes its formateur an instructor of that course.
      await linkFormateurToCourse(tx, created.courseId, created.formateurId);
      return created;
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

    const updatedGroup = await prisma.$transaction(async (tx) => {
      const updated = await tx.group.update({
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
      // Keep the formateur linked to the group's course after any change.
      await linkFormateurToCourse(tx, updated.courseId, updated.formateurId);
      return updated;
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

    // A formateur may only assign students to the groups they teach; admins can
    // assign to any group.
    if (req.user.role !== 'admin' && group.formateurId !== req.user.id) {
      return next(new AppError('You can only assign students to groups you teach.', 403, 'FORBIDDEN'));
    }

    const user = await prisma.user.findUnique({
      where: { id: req.body.userId },
      select: { id: true, role: true },
    });

    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));

    if (user.role !== 'student' && user.role !== 'employee') {
      return next(new AppError('User must be a student or employee to join a group.', 400, 'VALIDATION_ERROR'));
    }

    // The group must be bound to a course, and the student must have actually paid
    // for that course, before they can be assigned to it.
    if (!group.courseId) {
      return next(new AppError('This group is not linked to a course.', 400, 'VALIDATION_ERROR'));
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.body.userId,
          courseId: group.courseId,
        },
      },
      include: { payment: true },
    });

    if (!enrollment || !enrollment.payment || enrollment.payment.status !== PAYMENT_STATUS.PAID) {
      return next(new AppError('Student must have paid for this course to join the group.', 400, 'VALIDATION_ERROR'));
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

    // A student may belong to at most one group per course: reject if they're
    // already in another (non-deleted) group bound to the same course.
    const otherGroupMembership = await prisma.groupStudent.findFirst({
      where: {
        userId: req.body.userId,
        group: {
          id: { not: group.id },
          courseId: group.courseId,
          deletedAt: null,
        },
      },
      include: { group: { select: { name: true } } },
    });

    if (otherGroupMembership) {
      return next(new AppError(
        `Student is already in the group "${otherGroupMembership.group.name}" for this course. A student can only belong to one group per course.`,
        400,
        'VALIDATION_ERROR',
      ));
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

// GET /api/v1/courses/:courseId/groups
// Instructor drill-down step 1: the groups taught in a course. An admin sees every
// group for the course; an instructor sees only the groups where they are the formateur.
export const getCourseGroups = async (req, res, next) => {
  try {
    validateUUID(req.params.courseId, 'courseId');

    const where = {
      deletedAt: null,
      courseId: req.params.courseId,
      ...(req.user.role !== 'admin' && { formateurId: req.user.id }),
    };

    const groups = await prisma.group.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        formateur: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { students: true } },
      },
    });

    const result = groups.map((group) => ({
      ...group,
      studentCount: group._count.students,
      _count: undefined,
    }));

    res.status(200).json(successResponse({ groups: result }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/groups/:id/students
// Instructor drill-down step 2: the students of a chosen group. Restricted to the
// group's own formateur (or an admin) so an instructor can't read other groups.
export const getGroupStudents = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, courseId: true, formateurId: true, deletedAt: true },
    });

    if (!group || group.deletedAt) {
      return next(new AppError('Group not found.', 404, 'NOT_FOUND'));
    }

    if (req.user.role !== 'admin' && group.formateurId !== req.user.id) {
      return next(new AppError('You can only view students of groups you teach.', 403, 'FORBIDDEN'));
    }

    const memberships = await prisma.groupStudent.findMany({
      where: { groupId: group.id },
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
      },
    });

    res.status(200).json(successResponse({
      group: { id: group.id, name: group.name, courseId: group.courseId },
      students: memberships.map((m) => m.user),
    }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/groups/:id/students/:userId
export const removeStudentFromGroup = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'groupId');
    validateUUID(req.params.userId, 'userId');

    const group = await prisma.group.findUnique({
      where: { id: req.params.id },
      select: { id: true, formateurId: true },
    });

    if (!group) return next(new AppError('Group not found.', 404, 'NOT_FOUND'));

    // A formateur may only remove students from the groups they teach; admins can
    // remove from any group.
    if (req.user.role !== 'admin' && group.formateurId !== req.user.id) {
      return next(new AppError('You can only remove students from groups you teach.', 403, 'FORBIDDEN'));
    }

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

// GET /api/v1/groups/mine
// The authenticated student's own group memberships, with the course each group
// belongs to and its formateur, so a student can see their group for a paid course.
export const getMyGroups = async (req, res, next) => {
  try {
    const memberships = await prisma.groupStudent.findMany({
      where: { userId: req.user.id, group: { deletedAt: null } },
      orderBy: { createdAt: 'desc' },
      include: {
        group: {
          include: {
            course: { select: { id: true, title: true, thumbnail: true } },
            formateur: { select: { id: true, firstName: true, lastName: true } },
          },
        },
      },
    });

    const groups = memberships
      .filter((m) => m.group)
      .map((m) => ({
        groupId: m.group.id,
        name: m.group.name,
        description: m.group.description,
        course: m.group.course,
        formateur: m.group.formateur,
      }));

    res.status(200).json(successResponse({ groups }));
  } catch (error) {
    next(error);
  }
};
