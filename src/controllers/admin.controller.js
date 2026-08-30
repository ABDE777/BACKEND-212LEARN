import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination } from '../utils/response.js';
import { logAuditEvent } from '../utils/audit.js';
import { createNotification } from '../utils/gamification.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { validateUUID, validateRequired, validateEmail, validateEnum } from '../utils/validation.js';
import { sendPasswordResetEmail } from '../utils/email.js';
import { getJwtSecret } from '../config/jwt.js';
import { linkFormateurToCourse } from '../utils/groupSync.js';
import { PAYMENT_STATUS } from '../constants/payment.js';
import { getAppSettings } from '../utils/settings.js';

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
          role: true,
          isVerified: true,
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
    validateUUID(userId, 'userId');
    validateRequired(req.body, ['isVerified']);

    const { isVerified, notes } = req.body;

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
    validateUUID(userId, 'userId');
    validateRequired(req.body, ['isVerified']);

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

    validateUUID(paymentId, 'paymentId');

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

    // Only a settled (PAID) payment can be refunded — refunding a PENDING/
    // WAITING_VERIFICATION/REJECTED record is meaningless and corrupts state.
    if (payment.status !== 'PAID') {
      return next(new AppError(`Only PAID payments can be refunded (current status: ${payment.status}).`, 400, 'BAD_REQUEST'));
    }

    const updatedPayment = await prisma.payment.update({
      where: { id: paymentId },
      data: {
        status: PAYMENT_STATUS.REFUNDED,
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

// The distinct action/resource values (for the filter dropdowns) change rarely
// but scanning audit_logs for them on every page load is expensive once the
// table is large. Cache them briefly in-process.
let auditFilterCache = { at: 0, actions: [], resources: [] };
const AUDIT_FILTER_TTL_MS = 5 * 60 * 1000;

const getAuditFilterOptions = async () => {
  if (Date.now() - auditFilterCache.at < AUDIT_FILTER_TTL_MS) {
    return { actions: auditFilterCache.actions, resources: auditFilterCache.resources };
  }
  const [actions, resources] = await Promise.all([
    prisma.auditLog.findMany({ distinct: ['action'], select: { action: true }, orderBy: { action: 'asc' } }),
    prisma.auditLog.findMany({ distinct: ['resource'], select: { resource: true }, orderBy: { resource: 'asc' } }),
  ]);
  auditFilterCache = {
    at: Date.now(),
    actions: actions.map((a) => a.action).filter(Boolean),
    resources: resources.map((r) => r.resource).filter(Boolean),
  };
  return { actions: auditFilterCache.actions, resources: auditFilterCache.resources };
};

// ─── GET /api/v1/admin/audit-logs ────────────────────────────────────────────
// Fetch paginated action audit logs for every user (not only admins), with
// optional filters: action, resource, role, free-text search over the actor's
// name/email, and a createdAt date range.
export const getAuditLogs = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { action, resource, role, search, startDate, endDate } = req.query;

    const where = {};
    if (action && action !== 'all') where.action = String(action);
    if (resource && resource !== 'all') where.resource = String(resource);
    if (role && role !== 'all') where.user = { role: String(role) };

    if (search && String(search).trim()) {
      const q = String(search).trim();
      where.user = {
        ...(where.user || {}),
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      };
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate && !Number.isNaN(Date.parse(startDate))) where.createdAt.gte = new Date(startDate);
      if (endDate && !Number.isNaN(Date.parse(endDate))) {
        // Include the whole end day.
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, logs, filters] = await Promise.all([
      prisma.auditLog.count({ where }),
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          },
        },
      }),
      // Distinct action/resource values power the filter dropdowns (cached).
      getAuditFilterOptions(),
    ]);

    res.status(200).json(
      successResponse({ logs, filters }, paginationMeta(total, page, limit))
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

    const group = await prisma.$transaction(async (tx) => {
      const created = await tx.group.create({
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
      // A course-bound group makes its formateur an instructor of that course.
      await linkFormateurToCourse(tx, created.courseId, created.formateurId);
      return created;
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

    const group = await prisma.$transaction(async (tx) => {
      const updated = await tx.group.update({
        where: { id: groupId },
        data: {
          ...(name && { name: name.trim() }),
          ...(description !== undefined && { description: description?.trim() || null }),
          ...(courseId !== undefined && { courseId: courseId || null }),
        },
        include: GROUP_INCLUDE,
      });
      // If the group now points at a course, keep its formateur linked to it.
      await linkFormateurToCourse(tx, updated.courseId, updated.formateurId);
      return updated;
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

    const group = await prisma.$transaction(async (tx) => {
      const updated = await tx.group.update({
        where: { id: groupId },
        data: { formateurId },
        include: GROUP_INCLUDE,
      });
      // The new formateur becomes an instructor of the group's course.
      await linkFormateurToCourse(tx, updated.courseId, updated.formateurId);
      return updated;
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

// ─── POST /api/v1/admin/users ─────────────────────────────────────────────────
// Admin creates a new user.
export const createUser = async (req, res, next) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      isVerified,
    } = req.body;

    if (!firstName || !lastName || !email || !password || !role) {
      return next(
        new AppError('firstName, lastName, email, password and role are required.', 400, 'VALIDATION_ERROR')
      );
    }

    if (!['student', 'instructor', 'admin'].includes(role)) {
      return next(new AppError('role must be student, instructor or admin.', 400, 'VALIDATION_ERROR'));
    }

    // Normalize the email so it matches how login looks it up (trim + lowercase).
    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already exists (case-insensitive).
    const existingUser = await prisma.user.findFirst({
      where: { email: { equals: normalizedEmail, mode: 'insensitive' } },
    });
    if (existingUser) {
      return next(new AppError('Email already exists.', 400, 'VALIDATION_ERROR'));
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email: normalizedEmail,
        passwordHash,
        role,
        isVerified: isVerified !== undefined ? isVerified : false,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isVerified: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    await logAuditEvent(req.user.id, 'CREATE_USER', 'User', user.id, {
      email: user.email,
      role: user.role,
    });

    res.status(201).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/users/:userId ────────────────────────────────────────
// Admin updates a user.
export const updateUser = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const {
      firstName,
      lastName,
      email,
      role,
      isVerified,
      bio,
      password,
    } = req.body;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    // Normalize the email (trim + lowercase) so it matches how login looks it up.
    const normalizedEmail = email ? email.trim().toLowerCase() : undefined;

    // Check email uniqueness if changing email (case-insensitive).
    if (normalizedEmail && normalizedEmail !== targetUser.email) {
      const existingUser = await prisma.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          NOT: { id: userId },
        },
      });
      if (existingUser) {
        return next(new AppError('Email already exists.', 400, 'VALIDATION_ERROR'));
      }
    }

    // Validate role if provided
    if (role && !['student', 'instructor', 'admin'].includes(role)) {
      return next(new AppError('role must be student, instructor or admin.', 400, 'VALIDATION_ERROR'));
    }

    const updateData = {
      ...(firstName && { firstName }),
      ...(lastName && { lastName }),
      ...(normalizedEmail && { email: normalizedEmail }),
      ...(role && { role }),
      ...(isVerified !== undefined && { isVerified }),
      ...(bio !== undefined && { bio }),
    };

    // Optional password reset by the admin: hash the new password, stamp the
    // change, and rotate tokenVersion so any existing session is invalidated.
    if (typeof password === 'string' && password.trim()) {
      updateData.passwordHash = await bcrypt.hash(password.trim(), 12);
      updateData.passwordChangedAt = new Date();
      updateData.tokenVersion = { increment: 1 };
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isVerified: true,
        avatar: true,
        bio: true,
        createdAt: true,
      },
    });

    await logAuditEvent(req.user.id, 'UPDATE_USER', 'User', userId, {
      email: user.email,
      role: user.role,
    });

    res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /api/v1/admin/users/:userId ────────────────────────────────────────
// Admin deletes (soft-delete) a user.
export const deleteUser = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return next(new AppError('You cannot delete your own account.', 400, 'BAD_REQUEST'));
    }

    await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });

    await logAuditEvent(req.user.id, 'DELETE_USER', 'User', userId, {
      email: targetUser.email,
      role: targetUser.role,
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/admin/users/:userId/reset-password ────────────────────────
// Admin triggers sending a 5-min password reset email link to the specified user.
export const resetUserPassword = async (req, res, next) => {
  try {
    const { userId } = req.params;
    validateUUID(userId, 'userId');

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true, passwordHash: true, deletedAt: true },
    });

    if (!targetUser || targetUser.deletedAt) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    // Create a 5-minute reset token
    const resetSecret = getJwtSecret() + targetUser.passwordHash;
    const resetToken = jwt.sign({ id: targetUser.id }, resetSecret, { expiresIn: '5m' });

    const frontendUrl = process.env.FRONTEND_URL || 'https://212-learn.vercel.app';
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    await sendPasswordResetEmail(targetUser.email, targetUser.firstName, resetLink);

    await logAuditEvent(req.user.id, 'ADMIN_SEND_RESET_EMAIL', 'User', userId, {
      email: targetUser.email,
    });

    res.status(200).json(successResponse({
      message: `Password reset email has been sent to ${targetUser.email} (link valid for 5 minutes).`
    }));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /api/v1/admin/users/:userId/restore ──────────────────────────────
// Admin restores a soft-deleted user account.
export const restoreUser = async (req, res, next) => {
  try {
    const userId = req.params.userId || req.params.id;
    validateUUID(userId, 'userId');

    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    if (!targetUser.deletedAt) {
      return next(new AppError('User is not deleted.', 400, 'BAD_REQUEST'));
    }

    const restoredUser = await prisma.user.update({
      where: { id: userId },
      data: { deletedAt: null, restoreOtp: null, restoreOtpExp: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        isVerified: true,
        avatar: true,
        bio: true,
        createdAt: true,
        deletedAt: true,
      },
    });

    await logAuditEvent(req.user.id, 'RESTORE_USER', 'User', userId, {
      email: targetUser.email,
      role: targetUser.role,
    });

    res.status(200).json(successResponse({ user: restoredUser, message: 'User account restored successfully.' }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/admin/stats ──────────────────────────────────────────────────
// Returns a complete platform statistics snapshot for the admin dashboard.
// GET /api/v1/admin/overview — one consolidated snapshot for the admin dashboard
// landing view (stats + pending-KYC count + recent users), so the page makes a
// single request instead of several. Briefly cached to cut repeat load.
export const getAdminOverview = async (req, res, next) => {
  try {
    const [
      totalUsers, students, instructors, admins,
      totalCourses, activeCourses, draftCourses,
      totalCategories, totalEnrollments, revenueAgg,
      pendingPayments, paidPayments,
      pendingKycCount, recentUsers,
      pendingTransferCount, pendingPackCount,
    ] = await Promise.all([
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: 'student' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'instructor' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'admin' } }),
      prisma.course.count({ where: { deletedAt: null } }),
      prisma.course.count({ where: { deletedAt: null, status: 'published' } }),
      prisma.course.count({ where: { deletedAt: null, status: 'draft' } }),
      prisma.category.count({ where: { deletedAt: null } }),
      prisma.enrollment.count(),
      prisma.payment.aggregate({ _sum: { amount: true }, where: { status: 'PAID' } }),
      prisma.payment.count({ where: { provider: 'wafacash', status: 'WAITING_VERIFICATION' } }),
      prisma.payment.count({ where: { provider: 'wafacash', status: 'PAID' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'instructor', isVerified: false } }),
      prisma.user.findMany({
        where: { deletedAt: null },
        select: { id: true, firstName: true, lastName: true, email: true, role: true, isVerified: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      }),
      prisma.payment.count({ where: { provider: 'transfer', status: 'WAITING_VERIFICATION' } }),
      prisma.packPurchase.count({ where: { status: 'WAITING_VERIFICATION' } }),
    ]);

    const stats = {
      totalUsers, students, instructors, admins,
      totalCourses, activeCourses, draftCourses, totalCategories,
      totalEnrollments, totalRevenue: Number(revenueAgg._sum.amount ?? 0),
      // All payment sources awaiting admin verification (course wafacash +
      // transfer + pack purchases), so the pending badge reflects everything.
      pendingPayments: pendingPayments + pendingTransferCount + pendingPackCount,
      paidPayments,
    };

    res.set('Cache-Control', 'private, max-age=30');
    res.status(200).json(successResponse({ stats, pendingKycCount, recentUsers }));
  } catch (error) {
    next(error);
  }
};

export const getAdminStats = async (req, res, next) => {
  try {
    const [
      totalUsers,
      students,
      instructors,
      admins,
      totalCourses,
      activeCourses,
      draftCourses,
      totalCategories,
      totalEnrollments,
      revenueAgg,
      pendingPayments,
      paidPayments,
    ] = await Promise.all([
      // Users
      prisma.user.count({ where: { deletedAt: null } }),
      prisma.user.count({ where: { deletedAt: null, role: 'student' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'instructor' } }),
      prisma.user.count({ where: { deletedAt: null, role: 'admin' } }),
      // Courses
      prisma.course.count({ where: { deletedAt: null } }),
      prisma.course.count({ where: { deletedAt: null, status: 'published' } }),
      prisma.course.count({ where: { deletedAt: null, status: 'draft' } }),
      // Categories
      prisma.category.count({ where: { deletedAt: null } }),
      // Enrollments
      prisma.enrollment.count(),
      // Revenue — sum of all PAID payments
      prisma.payment.aggregate({
        _sum: { amount: true },
        where: { status: 'PAID' },
      }),
      // Wafacash pending
      prisma.payment.count({ where: { provider: 'wafacash', status: 'WAITING_VERIFICATION' } }),
      // Wafacash paid
      prisma.payment.count({ where: { provider: 'wafacash', status: 'PAID' } }),
    ]);

    const totalRevenue = Number(revenueAgg._sum.amount ?? 0);

    const stats = {
      totalUsers,
      students,
      instructors,
      admins,
      totalCourses,
      activeCourses,
      draftCourses,
      totalCategories,
      totalEnrollments,
      totalRevenue,
      pendingPayments,
      paidPayments,
    };

    res.status(200).json(successResponse({ stats }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/admin/analytics/instructors ──────────────────────────────────
// Returns detailed financial breakdown and teaching metrics for every instructor.
// Computes revenue generated per instructor from students they teach (via Groups or assigned courses),
// along with payout due (e.g. 70% instructor share) and platform retention (30%).
export const getInstructorFinancials = async (req, res, next) => {
  try {
    // Default to the global instructor share (live from settings). An explicit
    // ?sharePercentage= override is honored for what-if previews only.
    const settings = await getAppSettings();
    const storedShare = Number(settings.instructorSharePct ?? 70);
    const overrideShare = Number(req.query.sharePercentage);
    const defaultShare = Number.isFinite(overrideShare) && req.query.sharePercentage !== undefined
      ? overrideShare
      : storedShare;

    // Fetch all active instructors with their profiles, assigned courses and groups
    const instructors = await prisma.user.findMany({
      where: { role: 'instructor', deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        avatar: true,
        phone: true,
        isVerified: true,
        createdAt: true,
        instructorProfile: {
          select: {
            specialization: true,
            organization: true,
            position: true,
            experienceYears: true,
          },
        },
        coursesInstructed: {
          select: {
            role: true,
            course: {
              select: {
                id: true,
                title: true,
                price: true,
                status: true,
                level: true,
              },
            },
          },
        },
        groupsTaught: {
          where: { deletedAt: null },
          select: {
            id: true,
            name: true,
            courseId: true,
            course: { select: { id: true, title: true, price: true } },
            students: {
              select: {
                userId: true,
                createdAt: true,
                user: {
                  select: {
                    id: true,
                    firstName: true,
                    lastName: true,
                    email: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    // Fetch all PAID payments with enrollment info
    const paidPayments = await prisma.payment.findMany({
      where: { status: 'PAID' },
      select: {
        id: true,
        amount: true,
        currency: true,
        provider: true,
        transactionReference: true,
        paidAt: true,
        enrollment: {
          select: {
            id: true,
            userId: true,
            courseId: true,
            enrolledAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
            course: { select: { id: true, title: true, price: true } },
          },
        },
      },
      orderBy: { paidAt: 'desc' },
    });

    // Calculate metrics for each instructor
    const instructorReports = instructors.map((inst) => {
      // 1. Group teaching scope
      const groupStudentsMap = new Map();
      const taughtGroupCourseIds = new Set();

      inst.groupsTaught.forEach((g) => {
        if (g.courseId) taughtGroupCourseIds.add(g.courseId);
        g.students.forEach((s) => {
          if (!groupStudentsMap.has(s.userId)) {
            groupStudentsMap.set(s.userId, {
              user: s.user,
              joinedAt: s.createdAt,
              groups: [],
            });
          }
          groupStudentsMap.get(s.userId).groups.push(g.name);
        });
      });

      const groupStudentIds = new Set(groupStudentsMap.keys());

      // 2. Managed course IDs
      const managedCourseIds = new Set(
        inst.coursesInstructed.map((ci) => ci.course?.id).filter(Boolean)
      );

      // All course IDs linked to this instructor
      const allCourseIds = new Set([...taughtGroupCourseIds, ...managedCourseIds]);

      let matchingPayments = [];
      let scope = 'group_students';

      if (groupStudentIds.size > 0) {
        matchingPayments = paidPayments.filter((p) => {
          const pUserId = p.enrollment?.userId;
          const pCourseId = p.enrollment?.courseId;
          return groupStudentIds.has(pUserId) && (allCourseIds.has(pCourseId) || taughtGroupCourseIds.has(pCourseId));
        });
      } else if (managedCourseIds.size > 0) {
        scope = 'course_instructor';
        matchingPayments = paidPayments.filter((p) => {
          const pCourseId = p.enrollment?.courseId;
          return managedCourseIds.has(pCourseId);
        });
      }

      const totalRevenue = matchingPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
      const instructorEarnings = Number((totalRevenue * (defaultShare / 100)).toFixed(2));
      const platformFee = Number((totalRevenue * ((100 - defaultShare) / 100)).toFixed(2));

      const uniqueStudentIds = groupStudentIds.size > 0
        ? groupStudentIds.size
        : new Set(matchingPayments.map((p) => p.enrollment?.userId).filter(Boolean)).size;

      // Course breakdown
      const coursesSummary = Array.from(allCourseIds).map((cId) => {
        const ci = inst.coursesInstructed.find((c) => c.course?.id === cId);
        const groupMatch = inst.groupsTaught.find((g) => g.courseId === cId);
        const title = ci?.course?.title || groupMatch?.course?.title || 'Cours';
        const price = ci?.course?.price || groupMatch?.course?.price || 0;
        const coursePayments = matchingPayments.filter((p) => p.enrollment?.courseId === cId);
        const courseRev = coursePayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

        return {
          courseId: cId,
          title,
          price: Number(price),
          paymentsCount: coursePayments.length,
          revenueGenerated: Number(courseRev.toFixed(2)),
          instructorEarnings: Number((courseRev * (defaultShare / 100)).toFixed(2)),
        };
      });

      return {
        instructor: {
          id: inst.id,
          firstName: inst.firstName,
          lastName: inst.lastName,
          email: inst.email,
          avatar: inst.avatar,
          phone: inst.phone,
          isVerified: inst.isVerified,
          createdAt: inst.createdAt,
          specialization: inst.instructorProfile?.specialization || 'Formateur',
          organization: inst.instructorProfile?.organization || null,
        },
        teachingScope: scope,
        metrics: {
          coursesCount: allCourseIds.size,
          groupsCount: inst.groupsTaught.length,
          studentsCount: uniqueStudentIds,
          paidTransactionsCount: matchingPayments.length,
          totalRevenueGenerated: Number(totalRevenue.toFixed(2)),
          instructorSharePercentage: defaultShare,
          instructorPayoutDue: instructorEarnings,
          platformRetention: platformFee,
          currency: 'MAD',
        },
        groups: inst.groupsTaught.map((g) => ({
          id: g.id,
          name: g.name,
          courseTitle: g.course?.title || 'Général',
          studentsCount: g.students.length,
        })),
        courses: coursesSummary,
        recentPayments: matchingPayments.slice(0, 5).map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          currency: p.currency,
          paidAt: p.paidAt,
          provider: p.provider,
          studentName: `${p.enrollment?.user?.firstName || ''} ${p.enrollment?.user?.lastName || ''}`.trim(),
          studentEmail: p.enrollment?.user?.email,
          courseTitle: p.enrollment?.course?.title,
        })),
      };
    });

    // Overall summary KPIs across all instructors
    const grandTotalRevenue = instructorReports.reduce((s, r) => s + r.metrics.totalRevenueGenerated, 0);
    const grandTotalPayoutDue = instructorReports.reduce((s, r) => s + r.metrics.instructorPayoutDue, 0);
    const grandTotalPlatformFee = instructorReports.reduce((s, r) => s + r.metrics.platformRetention, 0);
    const grandTotalStudentsTaught = instructorReports.reduce((s, r) => s + r.metrics.studentsCount, 0);

    const sortedByRevenue = [...instructorReports].sort((a, b) => b.metrics.totalRevenueGenerated - a.metrics.totalRevenueGenerated);
    const topInstructor = sortedByRevenue[0]?.metrics.totalRevenueGenerated > 0 ? sortedByRevenue[0] : null;

    res.status(200).json(
      successResponse({
        summary: {
          totalInstructors: instructors.length,
          totalRevenueGenerated: Number(grandTotalRevenue.toFixed(2)),
          totalPayoutDue: Number(grandTotalPayoutDue.toFixed(2)),
          totalPlatformRetention: Number(grandTotalPlatformFee.toFixed(2)),
          totalStudentsTaught: grandTotalStudentsTaught,
          defaultSharePercentage: defaultShare,
          currency: 'MAD',
          topInstructor: topInstructor ? {
            id: topInstructor.instructor.id,
            name: `${topInstructor.instructor.firstName} ${topInstructor.instructor.lastName}`,
            revenue: topInstructor.metrics.totalRevenueGenerated,
            payoutDue: topInstructor.metrics.instructorPayoutDue,
            students: topInstructor.metrics.studentsCount,
          } : null,
        },
        instructors: sortedByRevenue,
      })
    );
  } catch (error) {
    next(error);
  }
};
