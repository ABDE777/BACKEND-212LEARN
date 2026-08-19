import { Prisma } from '@prisma/client';
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

    // Aggregate in the database (GROUP BY) instead of loading every PAID payment
    // into memory — the result sets are tiny (one row per month; top 5 courses),
    // so this stays flat no matter how many sales an instructor accrues.
    const courseFilter = courseIds
      ? Prisma.sql`AND e."courseId" = ANY(ARRAY[${Prisma.join(courseIds)}]::uuid[])`
      : Prisma.empty;

    const [monthlyRows, topRows] = await Promise.all([
      // Monthly revenue rollup across all time (one row per month).
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', COALESCE(p."paidAt", e."enrolledAt")), 'YYYY-MM') AS month,
               COALESCE(SUM(p."amount"), 0)::float8 AS revenue,
               COUNT(*)::int AS enrollments
        FROM "payments" p
        JOIN "enrollments" e ON e."id" = p."enrollmentId"
        WHERE p."status" = 'PAID' ${courseFilter}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // Top 5 courses by revenue.
      prisma.$queryRaw`
        SELECT e."courseId"::text AS "courseId", c."title" AS title,
               COALESCE(SUM(p."amount"), 0)::float8 AS revenue,
               COUNT(*)::int AS students
        FROM "payments" p
        JOIN "enrollments" e ON e."id" = p."enrollmentId"
        JOIN "courses" c ON c."id" = e."courseId"
        WHERE p."status" = 'PAID' ${courseFilter}
        GROUP BY e."courseId", c."title"
        ORDER BY revenue DESC
        LIMIT 5
      `,
    ]);

    const monthlyAll = monthlyRows.map((r) => ({
      month: r.month,
      revenue: Number(r.revenue),
      enrollments: Number(r.enrollments),
    }));
    const byMonth = Object.fromEntries(monthlyAll.map((m) => [m.month, m]));

    const monthly = monthlyAll.slice(-12); // Last 12 months for the chart
    const totalRevenue = monthlyAll.reduce((sum, m) => sum + m.revenue, 0);
    const totalEnrollments = monthlyAll.reduce((sum, m) => sum + m.enrollments, 0);

    // Current vs previous calendar month, for a month-over-month growth figure.
    const now = new Date();
    const curKey  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const prevD   = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevKey = `${prevD.getFullYear()}-${String(prevD.getMonth() + 1).padStart(2, '0')}`;
    const currentMonthRevenue  = byMonth[curKey]?.revenue  || 0;
    const previousMonthRevenue = byMonth[prevKey]?.revenue || 0;
    let growth = 0;
    if (previousMonthRevenue > 0) {
      growth = Math.round(((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100);
    } else if (currentMonthRevenue > 0) {
      growth = 100;
    }
    const averageOrderValue = totalEnrollments > 0 ? totalRevenue / totalEnrollments : 0;

    const topCourses = topRows.map((c) => ({
      courseId: c.courseId,
      title: c.title,
      revenue: Number(Number(c.revenue).toFixed(2)),
      students: Number(c.students),
    }));

    res.status(200).json(
      successResponse({
        totalRevenue: Number(totalRevenue.toFixed(2)),
        currency: 'MAD',
        totalEnrollments,
        currentMonthRevenue: Number(currentMonthRevenue.toFixed(2)),
        previousMonthRevenue: Number(previousMonthRevenue.toFixed(2)),
        growth,
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
        monthly: monthly.map((m) => ({ ...m, revenue: Number(m.revenue.toFixed(2)) })),
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

    // New students this calendar month (unique users enrolled since the 1st).
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const newStudentIds = new Set(
      enrollments.filter((e) => e.enrolledAt >= startOfMonth).map((e) => e.userId)
    );

    res.status(200).json(
      successResponse({
        totalStudents: uniqueStudentIds.length,
        totalEnrollments: enrollments.length,
        newStudentsThisMonth: newStudentIds.size,
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

    // Enrollment-weighted overall averages across all the instructor's courses.
    const totalEnrolled  = result.reduce((s, c) => s + c.totalEnrolled, 0);
    const totalCompleted = result.reduce((s, c) => s + c.completedCount, 0);
    const weightedProgress = result.reduce((s, c) => s + c.averageProgress * c.totalEnrolled, 0);
    const averageCompletion = totalEnrolled > 0 ? Math.round((totalCompleted / totalEnrolled) * 100) : 0;
    const averageProgress   = totalEnrolled > 0 ? Math.round(weightedProgress / totalEnrolled) : 0;

    res.status(200).json(
      successResponse({
        totalEnrolled,
        totalCompleted,
        averageCompletion,
        averageProgress,
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
