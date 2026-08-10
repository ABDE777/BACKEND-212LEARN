import { createMeeting, getCourseMeetings, startMeeting, endMeeting, updateMeeting, deleteMeeting, getMeetingJoinInfo } from './meeting.controller.js';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

// Mock Prisma
jest.mock('../config/prisma.js');

// Mock authorization utility
jest.mock('../utils/authorization.js', () => ({
  ensureCourseManager: jest.fn(),
}));

const { ensureCourseManager } = require('../utils/authorization.js');

describe('Meeting Controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createMeeting', () => {
    it('should create a meeting successfully', async () => {
      const req = {
        params: { courseId: 'course-123' },
        user: { id: 'user-123' },
        body: {
          title: 'Test Meeting',
          meetingDate: '2024-01-15T10:00:00Z',
          durationMinutes: 60,
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.meeting.create.mockResolvedValue({
        id: 'meeting-123',
        title: 'Test Meeting',
        meetingDate: new Date('2024-01-15T10:00:00Z'),
        roomName: '212learn-course-123-1234567890',
        status: 'SCHEDULED',
        durationMinutes: 60,
        meetingUrl: 'https://8x8.vc/app-id/212learn-course-123-1234567890',
      });

      ensureCourseManager.mockResolvedValue(true);

      await createMeeting(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalled();
      expect(prisma.meeting.create).toHaveBeenCalledWith({
        data: {
          courseId: 'course-123',
          title: 'Test Meeting',
          meetingDate: new Date('2024-01-15T10:00:00Z'),
          roomName: expect.stringContaining('212learn-'),
          status: 'SCHEDULED',
          durationMinutes: 60,
          meetingUrl: expect.stringContaining('https://'),
        },
      });
    });

    it('should throw error if courseId is invalid', async () => {
      const req = {
        params: { courseId: 'invalid-uuid' },
        user: { id: 'user-123' },
        body: { title: 'Test', meetingDate: '2024-01-15T10:00:00Z' },
      };
      const res = {};
      const next = jest.fn();

      await createMeeting(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });

    it('should throw error if title is missing', async () => {
      const req = {
        params: { courseId: '550e8400-e29b-41d4-a716-446655440000' },
        user: { id: 'user-123' },
        body: { meetingDate: '2024-01-15T10:00:00Z' },
      };
      const res = {};
      const next = jest.fn();

      await createMeeting(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('getCourseMeetings', () => {
    it('should return meetings for enrolled users', async () => {
      const req = {
        params: { courseId: 'course-123' },
        user: { id: 'user-123', role: 'student' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.course.findUnique.mockResolvedValue({ id: 'course-123', deletedAt: null });
      prisma.courseInstructor.findFirst.mockResolvedValue(null);
      prisma.enrollment.findUnique.mockResolvedValue({ userId: 'user-123', courseId: 'course-123' });
      prisma.meeting.findMany.mockResolvedValue([
        { id: 'meeting-1', title: 'Meeting 1', status: 'SCHEDULED' },
        { id: 'meeting-2', title: 'Meeting 2', status: 'COMPLETED' },
      ]);

      await getCourseMeetings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it('should return meetings for instructors', async () => {
      const req = {
        params: { courseId: 'course-123' },
        user: { id: 'user-123', role: 'instructor' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.course.findUnique.mockResolvedValue({ id: 'course-123', deletedAt: null });
      prisma.courseInstructor.findFirst.mockResolvedValue({ userId: 'user-123', courseId: 'course-123' });
      prisma.meeting.findMany.mockResolvedValue([{ id: 'meeting-1', title: 'Meeting 1' }]);

      await getCourseMeetings(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should return 403 for unauthorized users', async () => {
      const req = {
        params: { courseId: 'course-123' },
        user: { id: 'user-123', role: 'student' },
      };
      const res = {};
      const next = jest.fn();

      prisma.course.findUnique.mockResolvedValue({ id: 'course-123', deletedAt: null });
      prisma.courseInstructor.findFirst.mockResolvedValue(null);
      prisma.enrollment.findUnique.mockResolvedValue(null);

      await getCourseMeetings(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('startMeeting', () => {
    it('should start a SCHEDULED meeting', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'SCHEDULED',
        course: { id: 'course-123' },
      });
      prisma.meeting.update.mockResolvedValue({
        id: 'meeting-123',
        status: 'LIVE',
      });
      ensureCourseManager.mockResolvedValue(true);

      await startMeeting(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-123' },
        data: { status: 'LIVE' },
      });
    });

    it('should throw error if meeting is not SCHEDULED', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = {};
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'LIVE',
        course: { id: 'course-123' },
      });
      ensureCourseManager.mockResolvedValue(true);

      await startMeeting(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('endMeeting', () => {
    it('should end a LIVE meeting', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'LIVE',
        course: { id: 'course-123' },
      });
      prisma.meeting.update.mockResolvedValue({
        id: 'meeting-123',
        status: 'COMPLETED',
      });
      ensureCourseManager.mockResolvedValue(true);

      await endMeeting(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-123' },
        data: { status: 'COMPLETED' },
      });
    });
  });

  describe('updateMeeting', () => {
    it('should update a SCHEDULED meeting', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
        body: {
          title: 'Updated Title',
          meetingDate: '2024-01-20T10:00:00Z',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'SCHEDULED',
        course: { id: 'course-123' },
      });
      prisma.meeting.update.mockResolvedValue({
        id: 'meeting-123',
        title: 'Updated Title',
      });
      ensureCourseManager.mockResolvedValue(true);

      await updateMeeting(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(prisma.meeting.update).toHaveBeenCalledWith({
        where: { id: 'meeting-123' },
        data: {
          title: 'Updated Title',
          meetingDate: new Date('2024-01-20T10:00:00Z'),
        },
      });
    });

    it('should throw error if meeting is not SCHEDULED', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
        body: { title: 'Updated Title' },
      };
      const res = {};
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'LIVE',
        course: { id: 'course-123' },
      });
      ensureCourseManager.mockResolvedValue(true);

      await updateMeeting(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('deleteMeeting', () => {
    it('should delete a SCHEDULED meeting', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'SCHEDULED',
        course: { id: 'course-123' },
      });
      prisma.meeting.delete.mockResolvedValue({});
      ensureCourseManager.mockResolvedValue(true);

      await deleteMeeting(req, res, next);

      expect(res.status).toHaveBeenCalledWith(204);
      expect(res.send).toHaveBeenCalled();
    });

    it('should throw error if meeting is not SCHEDULED', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = {};
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'COMPLETED',
        course: { id: 'course-123' },
      });
      ensureCourseManager.mockResolvedValue(true);

      await deleteMeeting(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });

  describe('getMeetingJoinInfo', () => {
    it('should return join info for authorized user', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: {
          id: 'user-123',
          role: 'student',
          name: 'Test User',
          email: 'test@example.com',
        },
      };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'SCHEDULED',
        roomName: 'test-room',
        durationMinutes: 60,
        course: { id: 'course-123' },
      });
      prisma.courseInstructor.findFirst.mockResolvedValue(null);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 'user-123',
        courseId: 'course-123',
        payment: { status: 'PAID' },
      });

      await getMeetingJoinInfo(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalled();
    });

    it('should throw error if meeting is COMPLETED', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123' },
      };
      const res = {};
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'COMPLETED',
        course: { id: 'course-123' },
      });

      await getMeetingJoinInfo(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });

    it('should throw error if user is not enrolled or paid', async () => {
      const req = {
        params: { id: 'meeting-123' },
        user: { id: 'user-123', role: 'student' },
      };
      const res = {};
      const next = jest.fn();

      prisma.meeting.findUnique.mockResolvedValue({
        id: 'meeting-123',
        status: 'SCHEDULED',
        course: { id: 'course-123' },
      });
      prisma.courseInstructor.findFirst.mockResolvedValue(null);
      prisma.enrollment.findUnique.mockResolvedValue({
        userId: 'user-123',
        courseId: 'course-123',
        payment: { status: 'PENDING' },
      });

      await getMeetingJoinInfo(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
  });
});
