import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination } from '../utils/response.js';
import { logAuditEvent } from '../utils/audit.js';
import { createNotification } from '../utils/gamification.js';

// ─── GET /api/v1/admin/users/pending-kyc ─────────────────────────────────────
// Retrieve all instructors awaiting KYC verification.
export const getPendingKyc = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const where = {
      role: 'instructor',
      isVerified: false,
      deletedAt: null,
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          avatar: true,
          bio: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    res.status(200).json(
      successResponse({ users }, paginationMeta(total, page, limit))
    );
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/users/:userId/verify ────────────────────────────────
// Approve or reject/unverify an instructor's KYC status.
export const verifyInstructor = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isVerified, notes } = req.body;

    if (typeof isVerified !== 'boolean') {
      return next(new AppError('isVerified must be a boolean.', 400, 'VALIDATION_ERROR'));
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    if (targetUser.role !== 'instructor') {
      return next(new AppError('Only users with the instructor role can be KYC verified.', 400, 'BAD_REQUEST'));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isVerified },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isVerified: true },
    });

    // Write audit log
    await logAuditEvent(
      req.user.id,
      isVerified ? 'VERIFY_INSTRUCTOR' : 'UNVERIFY_INSTRUCTOR',
      'User',
      userId,
      { notes, email: targetUser.email }
    );

    // Notify the instructor
    const message = isVerified
      ? '🎉 Félicitations ! Votre profil d\'instructeur a été vérifié avec succès par l\'administration.'
      : '⚠️ Votre statut de vérification d\'instructeur a été révoqué ou rejeté par l\'administration.';
    await createNotification(userId, message);

    res.status(200).json(successResponse({ user: updatedUser, message: 'KYC verification updated.' }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/users/:userId/verify-student ─────────────────────────
// Verify or unverify a student's account status.
export const verifyStudent = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { isVerified, notes } = req.body;

    if (typeof isVerified !== 'boolean') {
      return next(new AppError('isVerified must be a boolean.', 400, 'VALIDATION_ERROR'));
    }

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    if (targetUser.role !== 'student') {
      return next(new AppError('Only users with the student role can be verified.', 400, 'BAD_REQUEST'));
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { isVerified },
      select: { id: true, firstName: true, lastName: true, email: true, role: true, isVerified: true },
    });

    // Write audit log
    await logAuditEvent(
      req.user.id,
      isVerified ? 'VERIFY_STUDENT' : 'UNVERIFY_STUDENT',
      'User',
      userId,
      { notes, email: targetUser.email }
    );

    // Notify the student
    const message = isVerified
      ? '✅ Votre compte a été vérifié avec succès par l\'administration.'
      : '⚠️ Votre statut de vérification a été révoqué par l\'administration.';
    await createNotification(userId, message);

    res.status(200).json(successResponse({ user: updatedUser, message: 'Student verification updated.' }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/payments/:paymentId/refund ─────────────────────────
// Refund a payment. Changes status to 'REFUNDED', removing access from student.
export const refundPayment = async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { notes } = req.body;

    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        enrollment: {
          include: {
            user: { select: { id: true, email: true, firstName: true } },
            course: { select: { id: true, title: true } },
          },
        },
      },
    });

    if (!payment) {
      return next(new AppError('Payment record not found.', 404, 'NOT_FOUND'));
    }

    if (payment.status === 'REFUNDED') {
      return next(new AppError('This payment has already been refunded.', 400, 'BAD_REQUEST'));
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: 'REFUNDED',
        notes: notes ? `${payment.notes || ''}\n[Refund Notes]: ${notes}` : payment.notes,
      },
    });

    // Write audit log
    await logAuditEvent(
      req.user.id,
      'REFUND_PAYMENT',
      'Payment',
      paymentId,
      {
        amount: payment.amount,
        currency: payment.currency,
        userId: payment.enrollment.userId,
        courseId: payment.enrollment.courseId,
        notes,
      }
    );

    // Notify the student
    await createNotification(
      payment.enrollment.userId,
      `💸 Votre paiement de ${payment.amount} ${payment.currency} pour le cours "${payment.enrollment.course.title}" a été remboursé.`
    );

    res.status(200).json(successResponse({ payment: updatedPayment, message: 'Payment status updated to REFUNDED.' }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/admin/audit-logs ────────────────────────────────────────────
// Fetch paginated administrative action audit logs.
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);

    const [total, logs] = await Promise.all([
      prisma.auditLog.count(),
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
    ]);

    res.status(200).json(
      successResponse({ logs }, paginationMeta(total, page, limit))
    );
  } catch (error) {
    next(error);
  }
};

const GROUP_INCLUDE = {
  course: { select: { id: true, title: true, status: true } },
  formateur: { select: { id: true, firstName: true, lastName: true, email: true, isVerified: true } },
  createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
  students: {
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } },
    },
    orderBy: { createdAt: 'desc' },
  },
};

const ensureInstructorUser = async (userId) => {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.deletedAt) {
    throw new AppError('Formateur not found.', 404, 'NOT_FOUND');
  }
  if (user.role !== 'instructor') {
    throw new AppError('Assigned formateur must have the instructor role.', 400, 'BAD_REQUEST');
  }
  return user;
};

const ensureStudentUsers = async (studentIds) => {
  const uniqueStudentIds = [...new Set(studentIds || [])];
  if (uniqueStudentIds.length === 0) {
    throw new AppError('studentIds must contain at least one student id.', 400, 'VALIDATION_ERROR');
  }

  const students = await prisma.user.findMany({
    where: { id: { in: uniqueStudentIds }, role: 'student', deletedAt: null },
    select: { id: true },
  });

  if (students.length !== uniqueStudentIds.length) {
    throw new AppError('All studentIds must belong to existing student users.', 400, 'BAD_REQUEST');
  }

  return uniqueStudentIds;
};

const ensureCourseExists = async (courseId) => {
  if (!courseId) return null;

  const course = await prisma.course.findUnique({ where: { id: courseId } });
  if (!course || course.deletedAt) {
    throw new AppError('Course not found.', 404, 'NOT_FOUND');
  }
  return course;
};

const ensureCourseInstructorLink = async (courseId, formateurId) => {
  if (!courseId) return;

  const existingLink = await prisma.courseInstructor.findFirst({
    where: { courseId, userId: formateurId },
  });

  if (!existingLink) {
    await prisma.courseInstructor.create({
      data: { courseId, userId: formateurId, role: 'group_formateur' },
    });
  }
};
// ─── GET /api/v1/admin/groups ────────────────────────────────────────────────
// List training groups with formateur, optional course, and student members.
export const getGroups = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { courseId, formateurId, search } = req.query;

    const where = {
      deletedAt: null,
      ...(courseId && { courseId }),
      ...(formateurId && { formateurId }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };

    const [total, groups] = await Promise.all([
      prisma.group.count({ where }),
      prisma.group.findMany({
        where,
        include: GROUP_INCLUDE,
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
      }),
    ]);

    res.status(200).json(successResponse({ groups }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/admin/groups ───────────────────────────────────────────────
// Admin creates a group and assigns it to a formateur.
export const createGroup = async (req, res, next) => {
  try {
    const { name, description, courseId, formateurId, studentIds = [] } = req.body;

    if (!name || !name.trim()) {
      return next(new AppError('Group name is required.', 400, 'VALIDATION_ERROR'));
    }
    if (!formateurId) {
      return next(new AppError('formateurId is required.', 400, 'VALIDATION_ERROR'));
    }

    await ensureInstructorUser(formateurId);
    await ensureCourseExists(courseId);

    const uniqueStudentIds = studentIds.length > 0 ? await ensureStudentUsers(studentIds) : [];

    const group = await prisma.group.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        courseId: courseId || null,
        formateurId,
        createdById: req.user.id,
        students: uniqueStudentIds.length > 0
          ? { create: uniqueStudentIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: GROUP_INCLUDE,
    });

    await logAuditEvent(req.user.id, 'CREATE_GROUP', 'Group', group.id, {
      name: group.name,
      courseId: group.courseId,
      formateurId: group.formateurId,
      studentCount: uniqueStudentIds.length,
    });

    await createNotification(formateurId, `Vous avez ete assigne au groupe "${group.name}".`);

    res.status(201).json(successResponse({ group }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/groups/:groupId ───────────────────────────────────────
// Admin updates group details (name, description, course).
export const updateGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { name, description, courseId } = req.body;

    const existingGroup = await prisma.group.findUnique({ where: { id: groupId } });
    if (!existingGroup || existingGroup.deletedAt) {
      return next(new AppError('Group not found.', 404, 'NOT_FOUND'));
    }

    if (courseId) {
      await ensureCourseExists(courseId);
    }

    const group = await prisma.group.update({
      where: { id: groupId },
      data: {
        ...(name && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(courseId !== undefined && { courseId: courseId || null }),
      },
      include: GROUP_INCLUDE,
    });

    await logAuditEvent(req.user.id, 'UPDATE_GROUP', 'Group', groupId, {
      name: group.name,
      courseId: group.courseId,
    });

    res.status(200).json(successResponse({ group }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/groups/:groupId/formateur ──────────────────────────
// Admin changes the formateur assigned to a group.
export const assignGroupFormateur = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { formateurId } = req.body;

    if (!formateurId) {
      return next(new AppError('formateurId is required.', 400, 'VALIDATION_ERROR'));
    }

    await ensureInstructorUser(formateurId);

    const existingGroup = await prisma.group.findUnique({ where: { id: groupId } });
    if (!existingGroup || existingGroup.deletedAt) {
      return next(new AppError('Group not found.', 404, 'NOT_FOUND'));
    }

    const group = await prisma.group.update({
      where: { id: groupId },
      data: { formateurId },
      include: GROUP_INCLUDE,
    });

    await logAuditEvent(req.user.id, 'ASSIGN_GROUP_FORMATEUR', 'Group', group.id, {
      previousFormateurId: existingGroup.formateurId,
      formateurId,
    });

    await createNotification(formateurId, `Vous avez ete assigne au groupe "${group.name}".`);

    res.status(200).json(successResponse({ group }));
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/admin/groups/:groupId/students ────────────────────────────
// Admin adds one or more students to a group.
export const addStudentsToGroup = async (req, res, next) => {
  try {
    const { groupId } = req.params;
    const { studentIds } = req.body;

    const group = await prisma.group.findUnique({ where: { id: groupId } });
    if (!group || group.deletedAt) {
      return next(new AppError('Group not found.', 404, 'NOT_FOUND'));
    }

    const uniqueStudentIds = await ensureStudentUsers(studentIds);

    await prisma.groupStudent.createMany({
      data: uniqueStudentIds.map((userId) => ({ groupId, userId })),
      skipDuplicates: true,
    });

    const updatedGroup = await prisma.group.findUnique({
      where: { id: groupId },
      include: GROUP_INCLUDE,
    });

    await logAuditEvent(req.user.id, 'ADD_GROUP_STUDENTS', 'Group', groupId, {
      studentIds: uniqueStudentIds,
    });

    res.status(200).json(successResponse({ group: updatedGroup }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/v1/admin/groups/:groupId/students/:studentId ───────────────
// Admin removes a student from a group.
export const removeStudentFromGroup = async (req, res, next) => {
  try {
    const { groupId, studentId } = req.params;

    const membership = await prisma.groupStudent.findFirst({
      where: { groupId, userId: studentId },
    });

    if (!membership) {
      return next(new AppError('Student is not a member of this group.', 404, 'NOT_FOUND'));
    }

    await prisma.groupStudent.delete({ where: { id: membership.id } });

    await logAuditEvent(req.user.id, 'REMOVE_GROUP_STUDENT', 'Group', groupId, { studentId });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
