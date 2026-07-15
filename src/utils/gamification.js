import prisma from '../config/prisma.js';

// ─── Notification Creator Helper ──────────────────────────────────────────────
export const createNotification = async (userId, content) => {
  try {
    await prisma.notification.create({
      data: {
        userId,
        content,
        isRead: false,
        sentAt: new Date(),
      },
    });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
};

// ─── Certificate Generation Helper ────────────────────────────────────────────
export const generateCertificate = async (userId, courseId) => {
  try {
    // Check if certificate already exists
    const existing = await prisma.certificate.findFirst({
      where: { userId, courseId },
    });
    if (existing) return;

    const certNumber = `CERT-${courseId.substring(0, 4).toUpperCase()}-${Math.floor(100000 + Math.random() * 900000)}`;

    await prisma.certificate.create({
      data: {
        userId,
        courseId,
        certificateNumber: certNumber,
        issuedAt: new Date(),
      },
    });

    await createNotification(userId, `🎓 Félicitations ! Votre certificat d'achèvement a été généré : ${certNumber}`);
  } catch (error) {
    console.error('Error generating certificate:', error);
  }
};

// ─── Gamification Badge Unlocking & Checks ────────────────────────────────────
export const checkAndAwardBadges = async (userId, courseId) => {
  try {
    // 1. Ensure basic definitions exist in DB
    const badgesToEnsure = [
      {
        name: 'First Steps',
        description: 'Completed your first lesson on 212LEARN.',
        icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&h=100&q=80',
      },
      {
        name: 'Quiz Master',
        description: 'Achieved a perfect 100% score on any quiz.',
        icon: 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=100&h=100&q=80',
      },
      {
        name: 'Course Finisher',
        description: 'Successfully completed all lessons in a course.',
        icon: 'https://images.unsplash.com/photo-1557683316-973673baf926?auto=format&fit=crop&w=100&h=100&q=80',
      },
    ];

    for (const badgeDef of badgesToEnsure) {
      await prisma.badgeDefinition.upsert({
        where: { name: badgeDef.name },
        update: {},
        create: badgeDef,
      });
    }

    // 2. Query user state
    const [lessonProgress, quizAttempts, userBadges] = await Promise.all([
      prisma.lessonProgress.findMany({ where: { userId, completed: true } }),
      prisma.quizAttempt.findMany({ where: { userId } }),
      prisma.userBadge.findMany({
        where: { userId },
        include: { badgeDefinition: true },
      }),
    ]);

    const hasBadge = (name) => userBadges.some((ub) => ub.badgeDefinition.name === name);

    // Rule A: Unlock "First Steps"
    if (lessonProgress.length >= 1 && !hasBadge('First Steps')) {
      const badge = await prisma.badgeDefinition.findUnique({ where: { name: 'First Steps' } });
      if (badge) {
        await prisma.userBadge.create({ data: { userId, badgeDefinitionId: badge.id } });
        await createNotification(userId, '🎉 Badge débloqué : "First Steps" ! Bienvenue dans votre parcours d\'apprentissage.');
      }
    }

    // Rule B: Unlock "Quiz Master"
    const perfectAttempts = quizAttempts.some((a) => Number(a.score) === 100);
    if (perfectAttempts && !hasBadge('Quiz Master')) {
      const badge = await prisma.badgeDefinition.findUnique({ where: { name: 'Quiz Master' } });
      if (badge) {
        await prisma.userBadge.create({ data: { userId, badgeDefinitionId: badge.id } });
        await createNotification(userId, '🏆 Badge débloqué : "Quiz Master" ! Vous avez obtenu un score parfait de 100%.');
      }
    }

    // Rule C: Unlock "Course Finisher" + Certificate
    if (courseId) {
      const allLessons = await prisma.lesson.findMany({
        where: { section: { courseId } },
      });
      const totalLessonsCount = allLessons.length;

      const completedCount = await prisma.lessonProgress.count({
        where: {
          userId,
          completed: true,
          lesson: { section: { courseId } },
        },
      });

      if (totalLessonsCount > 0 && completedCount === totalLessonsCount) {
        // Unlock badge
        if (!hasBadge('Course Finisher')) {
          const badge = await prisma.badgeDefinition.findUnique({ where: { name: 'Course Finisher' } });
          if (badge) {
            await prisma.userBadge.create({ data: { userId, badgeDefinitionId: badge.id } });
            await createNotification(userId, '🎓 Badge débloqué : "Course Finisher" ! Vous avez terminé toutes les leçons.');
          }
        }
        // Issue Certificate
        await generateCertificate(userId, courseId);
      }
    }
  } catch (error) {
    console.error('Error in gamification check:', error);
  }
};
