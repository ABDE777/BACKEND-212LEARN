import { Prisma } from '@prisma/client';
import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { validateUUID } from '../utils/validation.js';
import { getAppSettings } from '../utils/settings.js';

// ── Helper: courses via CourseInstructor (content-management scope) ───────────
const getInstructorCourseIds = async (userId) => {
  const links = await prisma.courseInstructor.findMany({
    where: { userId },
    select: { courseId: true },
  });
  return links.map((l) => l.courseId);
};

// ── Helper: student IDs in groups WHERE this user is the formateur ─────────────
// This is the "real teaching scope" — revenue = only from students they teach.
const getFormateurGroupStudentIds = async (userId) => {
  const gs = await prisma.groupStudent.findMany({
    where: { group: { formateurId: userId, deletedAt: null } },
    select: { userId: true },
  });
  return [...new Set(gs.map((g) => g.userId))];
};

// ── Helper: course IDs of groups WHERE this user is the formateur ──────────────
const getFormateurGroupCourseIds = async (userId) => {
  const groups = await prisma.group.findMany({
    where: { formateurId: userId, deletedAt: null, courseId: { not: null } },
    select: { courseId: true },
  });
  return [...new Set(groups.map((g) => g.courseId).filter(Boolean))];
};

// ─── GET /api/v1/instructor/analytics/revenue ─────────────────────────────────
// Revenue from students this instructor TEACHES via Groups.
// Falls back to CourseInstructor scope if no groups exist yet.
// Admin sees global revenue.
export const getRevenueAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';

    let studentIds = null;
    let courseIds  = null;
    let scope      = 'global';

    if (!isAdmin) {
      studentIds = await getFormateurGroupStudentIds(req.user.id);
      courseIds  = await getFormateurGroupCourseIds(req.user.id);

      if (studentIds.length > 0) {
        scope = 'group_students'; // formateur has groups → scope to their students
      } else {
        // Fallback: no groups yet, use CourseInstructor scope
        courseIds  = await getInstructorCourseIds(req.user.id);
        studentIds = null;
        scope      = 'course_instructor';
      }

      if ((courseIds?.length ?? 0) === 0 && !studentIds) {
        return res.status(200).json(
          successResponse({ totalRevenue: 0, currency: 'MAD', monthly: [], topCourses: [], scope })
        );
      }
    }

    const courseFilter = courseIds?.length
      ? Prisma.sql`AND e."courseId" = ANY(ARRAY[${Prisma.join(courseIds)}]::uuid[])`
      : Prisma.empty;
    const studentFilter = studentIds?.length
      ? Prisma.sql`AND e."userId" = ANY(ARRAY[${Prisma.join(studentIds)}]::uuid[])`
      : Prisma.empty;

    const [monthlyRows, topRows] = await Promise.all([
      prisma.$queryRaw`
        SELECT to_char(date_trunc('month', COALESCE(p."paidAt", e."enrolledAt")), 'YYYY-MM') AS month,
               COALESCE(SUM(p."amount"), 0)::float8 AS revenue,
               COUNT(*)::int AS enrollments
        FROM "payments" p
        JOIN "enrollments" e ON e."id" = p."enrollmentId"
        WHERE p."status" = 'PAID' ${courseFilter} ${studentFilter}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      prisma.$queryRaw`
        SELECT e."courseId"::text AS "courseId", c."title" AS title,
               COALESCE(SUM(p."amount"), 0)::float8 AS revenue,
               COUNT(*)::int AS students
        FROM "payments" p
        JOIN "enrollments" e ON e."id" = p."enrollmentId"
        JOIN "courses" c ON c."id" = e."courseId"
        WHERE p."status" = 'PAID' ${courseFilter} ${studentFilter}
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
    const monthly          = monthlyAll.slice(-12);
    const totalRevenue     = monthlyAll.reduce((sum, m) => sum + m.revenue, 0);
    const totalEnrollments = monthlyAll.reduce((sum, m) => sum + m.enrollments, 0);

    const now     = new Date();
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
    // Global instructor share (%), live from admin settings.
    const settings = await getAppSettings();
    const defaultShare = Number(settings.instructorSharePct ?? 70);
    const instructorEarnings = Number((totalRevenue * (defaultShare / 100)).toFixed(2));
    const currentMonthEarnings = Number((currentMonthRevenue * (defaultShare / 100)).toFixed(2));
    const previousMonthEarnings = Number((previousMonthRevenue * (defaultShare / 100)).toFixed(2));
    const platformRetention = Number((totalRevenue * ((100 - defaultShare) / 100)).toFixed(2));

    const topCourses = topRows.map((c) => ({
      courseId: c.courseId,
      title:    c.title,
      revenue:  Number(Number(c.revenue).toFixed(2)),
      instructorEarnings: Number((Number(c.revenue) * (defaultShare / 100)).toFixed(2)),
      students: Number(c.students),
    }));

    res.status(200).json(
      successResponse({
        totalRevenue: Number(totalRevenue.toFixed(2)),
        instructorEarnings,
        currentMonthEarnings,
        previousMonthEarnings,
        platformRetention,
        instructorSharePercentage: defaultShare,
        currency: 'MAD',
        totalEnrollments,
        currentMonthRevenue:  Number(currentMonthRevenue.toFixed(2)),
        previousMonthRevenue: Number(previousMonthRevenue.toFixed(2)),
        growth,
        averageOrderValue: Number(averageOrderValue.toFixed(2)),
        monthly: monthly.map((m) => ({
          ...m,
          revenue: Number(m.revenue.toFixed(2)),
          instructorEarnings: Number((m.revenue * (defaultShare / 100)).toFixed(2)),
        })),
        topCourses,
        scope,
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/instructor/analytics/students ───────────────────────────────
// Students this instructor TEACHES via Groups. Admin sees all.
export const getStudentAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let studentUserIds = null;
    let courseIds      = null;
    let groupsTaught   = [];

    if (!isAdmin) {
      studentUserIds = await getFormateurGroupStudentIds(req.user.id);
      courseIds      = await getFormateurGroupCourseIds(req.user.id);

      groupsTaught = await prisma.group.findMany({
        where: { formateurId: req.user.id, deletedAt: null },
        select: {
          id: true,
          name: true,
          course: { select: { id: true, title: true } },
          students: { select: { id: true } },
        },
      });

      if (studentUserIds.length === 0) {
        courseIds      = await getInstructorCourseIds(req.user.id);
        studentUserIds = null;
      }
      if ((courseIds?.length ?? 0) === 0 && !studentUserIds) {
        return res.status(200).json(successResponse({ totalStudents: 0, courses: [], groups: [] }));
      }
    }

    const enrollments = await prisma.enrollment.findMany({
      where: {
        ...(courseIds      && { courseId: { in: courseIds } }),
        ...(studentUserIds && { userId:   { in: studentUserIds } }),
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
        groups: groupsTaught.map((g) => ({
          id: g.id,
          name: g.name,
          courseTitle: g.course?.title || 'Général',
          studentsCount: g.students.length,
        })),
      })
    );
  } catch (error) {
    next(error);
  }
};

// ─── GET /api/v1/instructor/analytics/completion ─────────────────────────────
// Completion rates scoped to students the formateur teaches via Groups.
export const getCompletionAnalytics = async (req, res, next) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let studentUserIds = null;
    let courseIds      = null;

    if (!isAdmin) {
      studentUserIds = await getFormateurGroupStudentIds(req.user.id);
      courseIds      = await getFormateurGroupCourseIds(req.user.id);
      if (studentUserIds.length === 0) {
        courseIds      = await getInstructorCourseIds(req.user.id);
        studentUserIds = null;
      }
      if ((courseIds?.length ?? 0) === 0 && !studentUserIds) {
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
          where: {
            payment: { status: 'PAID' },
            ...(studentUserIds && { userId: { in: studentUserIds } }),
          },
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
