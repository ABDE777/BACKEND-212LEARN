import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { checkAndAwardBadges } from '../utils/gamification.js';
import { validateUUID } from '../utils/validation.js';

// ─── GET /api/v1/courses/:courseId/quizzes ────────────────────────────────────
// List all quizzes for a course (via its lessons → sections).
// Used by the frontend Quiz Player page: /learn/:courseId/quiz/:quizId
export const getQuizzesByCourse = async (req, res, next) => {
  try {
    validateUUID(req.params.courseId, 'courseId');

    const course = await prisma.course.findUnique({
      where: { id: req.params.courseId },
    });

    if (!course || course.deletedAt) {
      return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
    }

    // Non-published courses (draft/archived) are only visible to admins, the
    // course's own instructors, or enrolled users — never to the public.
    if (course.status !== 'published') {
      let allowed = req.user?.role === 'admin';
      if (!allowed && req.user) {
        const [asInstructor, asEnrolled] = await Promise.all([
          prisma.courseInstructor.findFirst({ where: { courseId: req.params.courseId, userId: req.user.id } }),
          prisma.enrollment.findUnique({ where: { userId_courseId: { userId: req.user.id, courseId: req.params.courseId } } }),
        ]);
        allowed = Boolean(asInstructor || asEnrolled);
      }
      if (!allowed) {
        return next(new AppError('Course not found.', 404, 'NOT_FOUND'));
      }
    }

    // Fetch all quizzes nested under the course's sections → lessons.
    // Scope attempts strictly to the current user; guests (no req.user) get an
    // impossible userId so lastAttempt is never another user's score.
    const attemptsUserId = req.user?.id ?? '00000000-0000-0000-0000-000000000000';
    const sections = await prisma.section.findMany({
      where: { courseId: req.params.courseId },
      orderBy: { position: 'asc' },
      include: {
        lessons: {
          orderBy: { position: 'asc' },
          include: {
            quizzes: {
              include: {
                questions: true,
                attempts: {
                  where: { userId: attemptsUserId },
                  orderBy: { attemptDate: 'desc' },
                  take: 1,
                },
              },
            },
          },
        },
      },
    });

    // Flatten into a simple quizzes array with context metadata
    const quizzes = [];
    sections.forEach((section) => {
      section.lessons.forEach((lesson) => {
        lesson.quizzes.forEach((quiz) => {
          quizzes.push({
            id: quiz.id,
            title: quiz.title,
            validationStatus: quiz.validationStatus,
            questionCount: quiz.questions.length,
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            sectionId: section.id,
            sectionTitle: section.title,
            lastAttempt: quiz.attempts[0] || null,
          });
        });
      });
    });

    res.status(200).json(successResponse({ courseId: req.params.courseId, quizzes }));
  } catch (error) {
    next(error);
  }
};

// ─── POST /api/v1/lessons/:lessonId/progress ─────────────────────────────────
// Log or update a student's progress on a lesson.
export const logProgress = async (req, res, next) => {
  try {
    validateUUID(req.params.lessonId, 'lessonId');

    const { completed, videoPosition, timeSpent } = req.body;
    const { lessonId } = req.params;
    const userId = req.user.id;

    const lesson = await prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    const progress = await prisma.lessonProgress.upsert({
      where: {
        userId_lessonId: { userId, lessonId },
      },
      update: {
        ...(completed     !== undefined && { completed: Boolean(completed) }),
        ...(videoPosition !== undefined && { videoPosition: Number(videoPosition) }),
        ...(timeSpent     !== undefined && { timeSpent: Number(timeSpent) }),
        ...(completed     === true      && { completedAt: new Date() }),
      },
      create: {
        userId,
        lessonId,
        completed:     Boolean(completed) || false,
        videoPosition: Number(videoPosition) || 0,
        timeSpent:     Number(timeSpent) || 0,
        ...(completed === true && { completedAt: new Date() }),
      },
    });

    const section = await prisma.section.findFirst({
      where: { lessons: { some: { id: lessonId } } },
    });
    const courseId = section?.courseId || null;

    if (completed === true) {
      checkAndAwardBadges(userId, courseId).catch(console.error);
    }

    res.status(200).json(successResponse({ progress }));
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/users/:userId/achievements ───────────────────────────────────
// Fetch a student's achievements: badges, certificates, quiz scores, completion %.
// Used by the frontend Student Dashboard: /student/dashboard
export const getAchievements = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Only the user themselves or an admin can view achievements
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return next(new AppError('You can only view your own achievements.', 403, 'FORBIDDEN'));
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return next(new AppError('User not found.', 404, 'NOT_FOUND'));
    }

    const [
      badges,
      certificates,
      enrollments,
      lessonProgresses,
      quizAttempts,
    ] = await Promise.all([
      // Badges earned
      prisma.userBadge.findMany({
        where: { userId },
        include: { badgeDefinition: true },
        orderBy: { obtainedAt: 'desc' },
      }),
      // Certificates earned
      prisma.certificate.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true } } },
        orderBy: { issuedAt: 'desc' },
      }),
      // Active enrollments
      prisma.enrollment.findMany({
        where: { userId },
        include: { course: { select: { id: true, title: true, duration: true } } },
      }),
      // Lesson progress across all lessons
      prisma.lessonProgress.findMany({ where: { userId } }),
      // Quiz attempts best scores
      prisma.quizAttempt.findMany({
        where: { userId },
        orderBy: { score: 'desc' },
        include: { quiz: { select: { id: true, title: true } } },
      }),
    ]);

    // Calculate completion percentage per enrolled course
    const completedLessons = lessonProgresses.filter((p) => p.completed).length;
    const totalLessons = lessonProgresses.length;

    // Calculate total points dynamically
    const quizPoints = quizAttempts.reduce((sum, attempt) => {
      const score = Number(attempt.score);
      if (score === 100) return sum + 50;
      if (score >= 60) return sum + 20;
      return sum;
    }, 0);
    const lessonPoints = completedLessons * 10;
    const totalPoints = lessonPoints + quizPoints;

    const stats = {
      totalEnrollments:   enrollments.length,
      completedLessons,
      totalLessons,
      completionRate:     totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0,
      badgesEarned:       badges.length,
      certificatesEarned: certificates.length,
      bestQuizScore:      quizAttempts[0]?.score ?? null,
      totalTimeSpent:     lessonProgresses.reduce((sum, p) => sum + (p.timeSpent || 0), 0),
      points:             totalPoints,
    };

    res.status(200).json(
      successResponse({
        userId,
        stats,
        badges:       badges.map((b) => ({ ...b.badgeDefinition, obtainedAt: b.obtainedAt })),
        certificates,
        enrollments:  enrollments.map((e) => e.course),
        quizAttempts: quizAttempts.slice(0, 10), // top 10 quiz attempts
      })
    );
  } catch (error) {
    next(error);
  }
};
