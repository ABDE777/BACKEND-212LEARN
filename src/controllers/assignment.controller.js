import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse, parsePagination, paginationMeta } from '../utils/response.js';
import { ensureCourseManager } from '../utils/authorization.js';
import { validateUUID, validateRequired, validateNumberRange, validateDate } from '../utils/validation.js';

// ─── POST /lessons/:lessonId/assignments ─────────────────────────────────────
export const createAssignment = async (req, res, next) => {
  try {
    validateUUID(req.params.lessonId, 'lessonId');
    validateRequired(req.body, ['title']);

    const { title, description, dueDate } = req.body;

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: { section: true },
    });

    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, lesson.section.courseId);

    if (dueDate) {
      validateDate(dueDate, 'dueDate');
    }

    const assignment = await prisma.assignment.create({
      data: {
        lessonId:    req.params.lessonId,
        title:       title.trim(),
        // description field is not in the schema — store via title if needed
        dueDate:     dueDate ? new Date(dueDate) : null,
      },
    });

    res.status(201).json(successResponse({ assignment }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /lessons/:lessonId/assignments ──────────────────────────────────────
export const getAssignments = async (req, res, next) => {
  try {
    validateUUID(req.params.lessonId, 'lessonId');

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: { section: true },
    });

    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    const assignments = await prisma.assignment.findMany({
      where:   { lessonId: req.params.lessonId },
      orderBy: { dueDate: 'asc' },
      include: { submissions: req.user.role !== 'student' }, // instructors/admins see all subs
    });

    res.status(200).json(successResponse({ assignments }));
  } catch (error) {
    next(error);
  }
};

// ─── POST /assignments/:assignmentId/submissions ──────────────────────────────
// Student submits their work (file upload via Cloudinary or a URL)
export const submitWork = async (req, res, next) => {
  try {
    validateUUID(req.params.assignmentId, 'assignmentId');

    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { lesson: { include: { section: true } } },
    });

    if (!assignment) {
      return next(new AppError('Assignment not found.', 404, 'NOT_FOUND'));
    }

    // Check due date if set
    if (assignment.dueDate && new Date() > assignment.dueDate) {
      return next(new AppError('The submission deadline has passed.', 400, 'DEADLINE_PASSED'));
    }

    // Check if already submitted
    const existing = await prisma.submission.findFirst({
      where: { assignmentId: req.params.assignmentId, userId: req.user.id },
    });
    if (existing) {
      return next(new AppError('You have already submitted this assignment.', 409, 'CONFLICT'));
    }

    // Resolve file URL: from upload or from body
    let fileUrl = req.body.fileUrl || null;
    if (req.file) {
      fileUrl = req.file.path; // Cloudinary URL
    }

    if (!fileUrl) {
      return next(new AppError('Please upload a file or provide a fileUrl.', 400, 'VALIDATION_ERROR'));
    }

    const submission = await prisma.submission.create({
      data: {
        assignmentId: req.params.assignmentId,
        userId:       req.user.id,
        fileUrl,
      },
    });

    res.status(201).json(successResponse({ submission }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /assignments/:assignmentId/submissions ──────────────────────────────
// Instructor / admin only: list all submissions for an assignment
export const getSubmissions = async (req, res, next) => {
  try {
    validateUUID(req.params.assignmentId, 'assignmentId');

    const assignment = await prisma.assignment.findUnique({
      where: { id: req.params.assignmentId },
      include: { lesson: { include: { section: true } } },
    });

    if (!assignment) {
      return next(new AppError('Assignment not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, assignment.lesson.section.courseId);

    const { page, limit, skip } = parsePagination(req.query);

    const [total, submissions] = await Promise.all([
      prisma.submission.count({ where: { assignmentId: req.params.assignmentId } }),
      prisma.submission.findMany({
        where:   { assignmentId: req.params.assignmentId },
        orderBy: { submittedAt: 'desc' },
        skip,
        take:    limit,
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, avatar: true } } },
      }),
    ]);

    res.status(200).json(successResponse({ submissions }, paginationMeta(total, page, limit)));
  } catch (error) {
    next(error);
  }
};

// ─── PATCH /submissions/:id/grade ─────────────────────────────────────────────
// Instructor / admin grades a submission
export const gradeSubmission = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'submissionId');

    const { grade, feedback } = req.body;

    validateRequired(req.body, ['grade']);
    validateNumberRange(Number(grade), { min: 0, max: 100 }, 'grade');

    const submission = await prisma.submission.findUnique({
      where: { id: req.params.id },
      include: { assignment: { include: { lesson: { include: { section: true } } } } },
    });

    if (!submission) {
      return next(new AppError('Submission not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, submission.assignment.lesson.section.courseId);

    const updated = await prisma.submission.update({
      where: { id: req.params.id },
      data: {
        grade: Number(grade),
        feedback: feedback?.trim() || null,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
    });

    res.status(200).json(successResponse({ submission: updated }));
  } catch (error) {
    next(error);
  }
};
