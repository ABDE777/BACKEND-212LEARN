import prisma from '../config/prisma.js';

export const getPublicStats = async (req, res, next) => {
  try {
    const [studentCount, courseCount, instructorCount, categoryCount] = await Promise.all([
      prisma.user.count({ where: { role: 'student', deletedAt: null } }),
      prisma.course.count({ where: { status: 'published', deletedAt: null } }),
      prisma.user.count({ where: { role: 'instructor', deletedAt: null } }),
      prisma.category.count(),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalUsers: studentCount,
        totalCourses: courseCount,
        totalInstructors: instructorCount,
        totalCategories: categoryCount,
        satisfactionRate: 98, // Placeholder - could be calculated from reviews
      },
    });
  } catch (error) {
    next(error);
  }
};
