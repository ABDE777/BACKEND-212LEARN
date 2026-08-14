import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

// Create a course update request
export const createCourseUpdateRequest = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, description, price, level, thumbnail } = req.body;
    const instructorId = req.user.id;

    // Verify the instructor is assigned to this course
    const courseInstructor = await prisma.courseInstructor.findFirst({
      where: {
        courseId,
        userId: instructorId,
      },
    });

    if (!courseInstructor) {
      return next(new AppError('You are not authorized to request updates for this course', 403, 'FORBIDDEN'));
    }

    // Check if course is published (only published courses require admin approval)
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course) {
      return next(new AppError('Course not found', 404, 'NOT_FOUND'));
    }

    if (course.status !== 'published') {
      return next(new AppError('Only published courses require update requests', 400, 'BAD_REQUEST'));
    }

    // Check if there's already a pending request for this course
    const existingRequest = await prisma.courseUpdateRequest.findFirst({
      where: {
        courseId,
        instructorId,
        status: 'PENDING',
      },
    });

    if (existingRequest) {
      return next(new AppError('You already have a pending update request for this course', 400, 'BAD_REQUEST'));
    }

    // Create the update request
    const updateRequest = await prisma.courseUpdateRequest.create({
      data: {
        courseId,
        instructorId,
        title: title || undefined,
        description: description || undefined,
        price: price ? parseFloat(price) : undefined,
        level: level || undefined,
        thumbnail: thumbnail || undefined,
      },
      include: {
        course: {
          select: {
            title: true,
            status: true,
          },
        },
        instructor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    res.status(201).json({
      status: 'success',
      data: {
        updateRequest,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get all course update requests (for admins)
export const getAllCourseUpdateRequests = async (req, res, next) => {
  try {
    const { status } = req.query;

    const where = status ? { status } : {};

    const updateRequests = await prisma.courseUpdateRequest.findMany({
      where,
      include: {
        course: {
          select: {
            title: true,
            status: true,
            thumbnail: true,
          },
        },
        instructor: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        updateRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get update requests for the current instructor
export const getInstructorUpdateRequests = async (req, res, next) => {
  try {
    const instructorId = req.user.id;
    const { status } = req.query;

    const where = {
      instructorId,
      ...(status && { status }),
    };

    const updateRequests = await prisma.courseUpdateRequest.findMany({
      where,
      include: {
        course: {
          select: {
            title: true,
            status: true,
            thumbnail: true,
          },
        },
        reviewer: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        updateRequests,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Approve a course update request
export const approveCourseUpdateRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.id;

    // Admin authorization is enforced by restrictTo('admin') on the route.

    const updateRequest = await prisma.courseUpdateRequest.findUnique({
      where: { id: requestId },
    });

    if (!updateRequest) {
      return next(new AppError('Update request not found', 404, 'NOT_FOUND'));
    }

    if (updateRequest.status !== 'PENDING') {
      return next(new AppError('This request has already been processed', 400, 'BAD_REQUEST'));
    }

    // Update the course with the requested changes
    const courseUpdateData = {};
    if (updateRequest.title) courseUpdateData.title = updateRequest.title;
    if (updateRequest.description !== null) courseUpdateData.description = updateRequest.description;
    if (updateRequest.price !== null) courseUpdateData.price = updateRequest.price;
    if (updateRequest.level) courseUpdateData.level = updateRequest.level;
    if (updateRequest.thumbnail) courseUpdateData.thumbnail = updateRequest.thumbnail;

    await prisma.course.update({
      where: { id: updateRequest.courseId },
      data: courseUpdateData,
    });

    // Update the request status
    const approvedRequest = await prisma.courseUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
      },
      include: {
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        updateRequest: approvedRequest,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Reject a course update request
export const rejectCourseUpdateRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { rejectionReason } = req.body;
    const adminId = req.user.id;

    // Admin authorization is enforced by restrictTo('admin') on the route.

    const updateRequest = await prisma.courseUpdateRequest.findUnique({
      where: { id: requestId },
    });

    if (!updateRequest) {
      return next(new AppError('Update request not found', 404, 'NOT_FOUND'));
    }

    if (updateRequest.status !== 'PENDING') {
      return next(new AppError('This request has already been processed', 400, 'BAD_REQUEST'));
    }

    // Update the request status
    const rejectedRequest = await prisma.courseUpdateRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        reviewedBy: adminId,
        reviewedAt: new Date(),
        rejectionReason: rejectionReason || 'No reason provided',
      },
      include: {
        course: {
          select: {
            title: true,
          },
        },
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        updateRequest: rejectedRequest,
      },
    });
  } catch (error) {
    next(error);
  }
};
