import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID, validateRequired, validateEnum } from '../utils/validation.js';
import { ensureCourseManager } from '../utils/authorization.js';

// POST /api/v1/courses/:courseId/meetings - Create meeting (instructor/admin)
export const createMeeting = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    const { title, meetingDate, durationMinutes } = req.body;

    validateUUID(courseId, 'courseId');
    validateRequired(req.body, ['title', 'meetingDate']);

    await ensureCourseManager(req.user, courseId);

    // Generate unique room name
    const roomName = `212learn-${courseId}-${Date.now()}`;

    const meeting = await prisma.meeting.create({
      data: {
        courseId,
        title,
        meetingDate: new Date(meetingDate),
        roomName,
        status: 'SCHEDULED',
        durationMinutes: durationMinutes || 60,
        meetingUrl: `https://meet.jit.si/${roomName}`,
      },
    });

    res.status(201).json(successResponse({ meeting }));
  } catch (error) {
    next(error);
  }
};

// GET /api/v1/courses/:courseId/meetings - Get meetings (instructor/admin for all, students for completed)
export const getCourseMeetings = async (req, res, next) => {
  try {
    const { courseId } = req.params;
    validateUUID(courseId, 'courseId');

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Check if user is enrolled (for students) or instructor/admin
    const isInstructorOrAdmin = req.user.role === 'instructor' || req.user.role === 'admin';
    const isInstructor = await prisma.courseInstructor.findFirst({
      where: { courseId, userId: req.user.id },
    });

    const isEnrolled = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: req.user.id,
          courseId,
        },
      },
    });

    if (!isInstructorOrAdmin && !isInstructor && !isEnrolled) {
      return next(new AppError('You do not have access to this course.', 403, 'FORBIDDEN'));
    }

    const meetings = await prisma.meeting.findMany({
      where: { courseId },
      orderBy: { meetingDate: 'desc' },
    });

    // For students, only show completed meetings with recordingUrl
    const filteredMeetings = isInstructorOrAdmin || isInstructor
      ? meetings
      : meetings.filter((m) => m.status === 'COMPLETED' && m.recordingUrl);

    res.status(200).json(successResponse({ meetings: filteredMeetings }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/meetings/:id/start - Start meeting (instructor/admin)
export const startMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'SCHEDULED') {
      return next(new AppError('Meeting can only be started from SCHEDULED status.', 400, 'BAD_REQUEST'));
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: { status: 'LIVE' },
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// PATCH /api/v1/meetings/:id/end - End meeting (instructor/admin)
export const endMeeting = async (req, res, next) => {
  try {
    const { id } = req.params;
    validateUUID(id, 'meetingId');

    const meeting = await prisma.meeting.findUnique({
      where: { id },
      include: { course: true },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, meeting.courseId);

    if (meeting.status !== 'LIVE') {
      return next(new AppError('Meeting can only be ended from LIVE status.', 400, 'BAD_REQUEST'));
    }

    const updated = await prisma.meeting.update({
      where: { id },
      data: { status: 'COMPLETED' },
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};

// POST /api/v1/meetings/webhook - Webhook for recording completion
export const meetingWebhook = async (req, res, next) => {
  try {
    const { roomName, recordingUrl } = req.body;

    if (!roomName || !recordingUrl) {
      return next(new AppError('Missing required fields: roomName, recordingUrl', 400, 'BAD_REQUEST'));
    }

    const meeting = await prisma.meeting.findFirst({
      where: { roomName },
    });

    if (!meeting) {
      return next(new AppError('Meeting not found.', 404, 'NOT_FOUND'));
    }

    const updated = await prisma.meeting.update({
      where: { id: meeting.id },
      data: {
        recordingUrl,
        status: 'COMPLETED',
      },
    });

    res.status(200).json(successResponse({ meeting: updated }));
  } catch (error) {
    next(error);
  }
};
