import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';

export const ensureCourseManager = async (user, courseId) => {
  if (!user) {
    throw new AppError('You must be logged in to perform this action.', 401, 'UNAUTHORIZED');
  }

  if (user.role === 'admin') {
    return;
  }

  if (user.role !== 'instructor') {
    throw new AppError('You do not have permission to perform this action.', 403, 'FORBIDDEN');
  }

  const instructor = await prisma.courseInstructor.findFirst({
    where: {
      userId: user.id,
      courseId,
    },
  });

  if (!instructor) {
    throw new AppError('You can only manage courses assigned to you.', 403, 'FORBIDDEN');
  }
};