import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, paginationMeta, parsePagination, parseSort } from '../utils/response.js';
import { cloudinary } from '../config/cloudinary.js';
import { validateUUID } from '../utils/validation.js';

const USER_SELECT = {
  id: true, firstName: true, lastName: true, email: true,
  role: true, isVerified: true, avatar: true, bio: true,
  createdAt: true, lastLogin: true, deletedAt: true, phone: true,
};

const SORTABLE_FIELDS = ['createdAt', 'firstName', 'lastName', 'email', 'role'];

// GET /api/v1/users?page=1&limit=20&role=admin&sort=createdAt&order=desc&deleted=true
export const getAllUsers = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const orderBy = parseSort(req.query, SORTABLE_FIELDS);
    const { role, search, deleted, includeDeleted } = req.query;

    let deletedAtFilter = { deletedAt: null };
    if (deleted === 'true' || deleted === true || deleted === 'only') {
      deletedAtFilter = { deletedAt: { not: null } };
    } else if (includeDeleted === 'true' || includeDeleted === true) {
      deletedAtFilter = {};
    }

    const where = {
      ...deletedAtFilter,
      ...(role && { role }),
      ...(search && {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName:  { contains: search, mode: 'insensitive' } },
          { email:     { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [total, users] = await Promise.all([
      prisma.user.count({ where }),
      prisma.user.findMany({
        where,
        orderBy,
        ...(skip !== undefined && { skip }),
        ...(limit !== null && { take: limit }),
        include: {
          studentProfile: true,
          instructorProfile: true,
        }
      }),
    ]);

    // Attach profile data to each user based on role
    const usersWithProfiles = users.map(user => ({
      ...user,
      profile: user.role === 'student' ? user.studentProfile : 
               user.role === 'instructor' ? user.instructorProfile : null,
      studentProfile: undefined,
      instructorProfile: undefined,
    }));

    res.status(200).json(successResponse({ users: usersWithProfiles }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/users/:id
export const getUser = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'userId');

    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      include: {
        studentProfile: true,
        instructorProfile: true,
      }
    });

    if (!user) return next(new AppError('User not found.', 404, 'NOT_FOUND'));

    // Attach profile data based on role
    const userWithProfile = {
      ...user,
      profile: user.role === 'student' ? user.studentProfile : 
               user.role === 'instructor' ? user.instructorProfile : null,
      studentProfile: undefined,
      instructorProfile: undefined,
    };

    res.status(200).json(successResponse({ user: userWithProfile }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/users/me
export const updateMe = async (req, res, next) => {
  try {
    // Block attempts to escalate role or change password through this endpoint
    const { password, role, passwordHash, ...allowed } = req.body;

    // Extract profile-specific fields
    const studentProfileFields = ['school', 'fieldOfStudy', 'educationLevel', 'academicYear', 'group', 'isSelfDirected'];
    const instructorProfileFields = ['specialization', 'organization', 'experienceYears', 'teachingMode'];

    const studentProfileData = {};
    const instructorProfileData = {};
    const userData = {};

    Object.keys(allowed).forEach(key => {
      if (studentProfileFields.includes(key)) {
        studentProfileData[key] = allowed[key];
      } else if (instructorProfileFields.includes(key)) {
        instructorProfileData[key] = allowed[key];
      } else {
        userData[key] = allowed[key];
      }
    });

    // Update user basic info
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: userData,
    });

    // Update profile based on role
    if ((req.user.role === 'student' || req.user.role === 'employee') && Object.keys(studentProfileData).length > 0) {
      await prisma.studentProfile.update({
        where: { userId: req.user.id },
        data: studentProfileData,
      });
    } else if (req.user.role === 'instructor' && Object.keys(instructorProfileData).length > 0) {
      await prisma.instructorProfile.update({
        where: { userId: req.user.id },
        data: instructorProfileData,
      });
    }

    // Fetch updated user with profile
    const updatedUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        studentProfile: true,
        instructorProfile: true,
      },
    });

    const userWithProfile = {
      ...updatedUser,
      studentProfile: (updatedUser.role === 'student' || updatedUser.role === 'employee') ? updatedUser.studentProfile : null,
      instructorProfile: updatedUser.role === 'instructor' ? updatedUser.instructorProfile : null,
    };

    res.status(200).json(successResponse({ user: userWithProfile }));
  } catch (error) {
    next(error);
  }
};

// DELETE /api/v1/users/me  →  soft-delete, 204 No Content
export const deleteMe = async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.user.id },
      data: { deletedAt: new Date() },
    });

    // 204 must NOT have a body
    res.status(204).end();
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/users/me/avatar  →  upload avatar image
export const uploadAvatar = async (req, res, next) => {
  try {
    if (!req.file) {
      return next(new AppError('No file uploaded.', 400, 'VALIDATION_ERROR'));
    }

    // Delete old avatar if exists
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { avatar: true },
    });

    if (currentUser.avatar) {
      try {
        // Extract public ID from Cloudinary URL
        const publicId = currentUser.avatar.split('/').pop().split('.')[0];
        await cloudinary.uploader.destroy(`212learn/images/${publicId}`);
      } catch (err) {
        // Ignore deletion errors
        console.warn('Failed to delete old avatar:', err.message);
      }
    }

    // Update user with new avatar URL
    const user = await prisma.user.update({
      where: { id: req.user.id },
      data: { avatar: req.file.path },
    });

    res.status(200).json(successResponse({ user }));
  } catch (error) {
    next(error);
  }
};
