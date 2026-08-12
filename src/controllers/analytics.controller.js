import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID } from '../utils/validation.js';

// ── Helper: Get instructor's course IDs ─────────────────────────────────────
const getInstructorCourseIds = async (userId) => {
  const links = await prisma.courseInstructor.findMany({
    where: { userId },
    select: { courseId: true },
  });
  return links.map((l) => l.courseId);
};

// ─── GET /api/v1/instructor/analytics/revenue ─────────────────────────────────
// Monthly revenue trend for an instructor's courses (last 12 months).
// Admin sees global revenue when accessing this endpoint.
export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';

    // Build course filter
    let courseIds = null;
    if (!isAdmin) {
      courseIds = await getInstructorCourseIds(req.user.id);
      if (courseIds.length === 0) {
        return res.status(200).json(
          successResponse({ totalRevenue: 0, currency: 'MAD', monthly: [], topCourses: [] })
        );
      }
    }

    // Fetch all PAID payments for instructor's courses
    const payments = await prisma.payment.findMany({
      where: {
        status: 'PAID',
        ...(courseIds && {
          enrollment: { courseId: { in: courseIds } },
        }),
      },
      include: {
        enrollment: {
          include: {
            course: { select: { id: true, title: true } },
          },
        },
      },
      orderBy: { paidAt: 'asc' },
    });

    // Group by month (YYYY-MM)
    const monthlyMap = {};
    payments.forEach((p) => {
      const d = p.paidAt || p.enrollment.enrolledAt;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[key]) monthlyMap[key] = { month: key, revenue: 0, enrollments: 0 };
      monthlyMap[key].revenue     += Number(p.amount);
      monthlyMap[key].enrollments += 1;
    });

    const monthly = Object.values(monthlyMap).slice(-12); // Last 12 months
    const totalRevenue = payments.reduce((sum, p) => sum + Number(p.amount), 0);

    // Top courses by revenue
    const courseRevenueMap = {};
    payments.forEach((p) => {
      const course = p.enrollment.course;
      if (!courseRevenueMap[course.id]) {
        courseRevenueMap[course.id] = { courseId: course.id, title: course.title, revenue: 0, students: 0 };
      }
      courseRevenueMap[course.id].revenue  += Number(p.amount);
      courseRevenueMap[course.id].students += 1;
    });

    const topCourses = Object.values(courseRevenueMap)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    res.status(200).json(
      successResponse({
        totalRevenue: Number(totalRevenue.toFixed(2)),
        currency: 'MAD',
        monthly,
        topCourses,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/instructor/analytics/students ───────────────────────────────
// Active student metrics per course for an instructor.
export const getStudentAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let courseIds = null;

    if (!isAdmin) {
      courseIds = await getInstructorCourseIds(req.user.id);
      if (courseIds.length === 0) {
        return res.status(200).json(successResponse({ totalStudents: 0, courses: [] }));
      }
    }

    // Fetch enrollments with PAID payments
    const enrollments = await prisma.enrollment.findMany({
      where: {
        ...(courseIds && { courseId: { in: courseIds } }),
        payment: { status: 'PAID' },
      },
      include: {
        course:  { select: { id: true, title: true, level: true } },
        payment: { select: { status: true, amount: true, currency: true } },
        user:    { select: { id: true, firstName: true, lastName: true, email: true, createdAt: true } },
      },
      orderBy: { enrolledAt: 'desc' },
    });

    // Aggregate per course
    const courseMap = {};
    enrollments.forEach((e) => {
      const cId = e.course.id;
      if (!courseMap[cId]) {
        courseMap[cId] = {
          courseId:  cId,
          title:     e.course.title,
          level:     e.course.level,
          students:  0,
          recentStudents: [],
        };
      }
      courseMap[cId].students += 1;
      if (courseMap[cId].recentStudents.length < 5) {
        courseMap[cId].recentStudents.push({
          name:        `${e.user.firstName} ${e.user.lastName}`,
          email:       e.user.email,
          enrolledAt:  e.enrolledAt,
        });
      }
    });

    const uniqueStudentIds = [...new Set(enrollments.map((e) => e.userId))];

    res.status(200).json(
      successResponse({
        totalStudents: uniqueStudentIds.length,
        totalEnrollments: enrollments.length,
        courses: Object.values(courseMap).sort((a, b) => b.students - a.students),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/instructor/analytics/completion ─────────────────────────────
// Course completion rates: % of students who completed all lessons per course.
export const getCompletionAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let courseIds = null;

    if (!isAdmin) {
      courseIds = await getInstructorCourseIds(req.user.id);
      if (courseIds.length === 0) {
        return res.status(200).json(successResponse({ courses: [] }));
      }
    }

    // Fetch courses with sections and lessons
    const courses = await prisma.course.findMany({
      where: {
        deletedAt: null,
        ...(courseIds && { id: { in: courseIds } }),
      },
      include: {
        sections: {
          include: { lessons: { select: { id: true } } },
        },
        enrollments: {
          where: { payment: { status: 'PAID' } },
          select: { userId: true },
        },
      },
    });

    const result = await Promise.all(
      courses.map(async (course) => {
        const allLessonIds = course.sections.flatMap((s) => s.lessons.map((l) => l.id));
        const totalLessons = allLessonIds.length;
        const enrolledUserIds = course.enrollments.map((e) => e.userId);
        const totalEnrolled = enrolledUserIds.length;

        if (totalLessons === 0 || totalEnrolled === 0) {
          return {
            courseId:       course.id,
            title:          course.title,
            totalLessons,
            totalEnrolled,
            completedCount: 0,
            completionRate: 0,
            averageProgress: 0,
          };
        }

        // Count students who completed ALL lessons in this course
        let completedCount = 0;
        let totalProgressSum = 0;

        for (const userId of enrolledUserIds) {
          const completedLessons = await prisma.lessonProgress.count({
            where: {
              userId,
              completed: true,
              lessonId: { in: allLessonIds },
            },
          });
          const progress = (completedLessons / totalLessons) * 100;
          totalProgressSum += progress;
          if (completedLessons === totalLessons) completedCount++;
        }

        return {
          courseId:        course.id,
          title:           course.title,
          totalLessons,
          totalEnrolled,
          completedCount,
          completionRate:  Math.round((completedCount / totalEnrolled) * 100),
          averageProgress: Math.round(totalProgressSum / totalEnrolled),
        };
      })
    );

    res.status(200).json(
      successResponse({
        courses: result.sort((a, b) => b.completionRate - a.completionRate),
      })
    );
  } catch (error) {
    next(error);
  }
};

// NOTE: createMeeting / getCourseMeetings used to be duplicated here but were
// dead code — the live handlers live in meeting.controller.js and are what
// meeting.routes.js mounts. Removed to avoid confusion and drift.
