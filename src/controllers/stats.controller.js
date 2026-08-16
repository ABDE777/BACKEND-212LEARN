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

export const getPublicTestimonials = async (req, res, next) => {
  try {
    const reviews = await prisma.review.findMany({
      where: {
        comment: {
          not: null,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            avatar: true,
          },
        },
        course: {
          select: {
            id: true,
            title: true,
          },
        },
      },
      orderBy: {
        reviewDate: 'desc',
      },
      take: 6,
    });

    res.status(200).json({
      success: true,
      data: reviews,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicInstructors = async (req, res, next) => {
  try {
    const instructors = await prisma.user.findMany({
      where: {
        role: 'instructor',
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        skills: true,
        socialLinks: true,
        instructorProfile: {
          select: {
            situation: true,
            expertiseDomain: true,
            specialization: true,
            organization: true,
            position: true,
            experienceYears: true,
            teachingMode: true,
          },
        },
        coursesInstructed: {
          select: {
            course: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
      take: 12,
    });

    res.status(200).json({
      success: true,
      data: instructors,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicAdmins = async (req, res, next) => {
  try {
    const admins = await prisma.user.findMany({
      where: {
        role: 'admin',
        deletedAt: null,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        avatar: true,
        bio: true,
        skills: true,
        socialLinks: true,
      },
    });

    res.status(200).json({
      success: true,
      data: admins,
    });
  } catch (error) {
    next(error);
  }
};
