/**
 * When a training Group is tied to both a course and a formateur, that formateur
 * must also be an instructor of the course — otherwise they can't manage it and
 * it won't show up in their "my courses" list (GET /courses?instructorId=me).
 *
 * This links the formateur to the course idempotently. It's safe to call on every
 * group create/update: the upsert on the (courseId, userId) unique key means a
 * repeat call is a no-op, and it never removes an existing link (a user may be the
 * course's lead instructor or teach other groups in it).
 *
 * @param {import('@prisma/client').PrismaClient | import('@prisma/client').Prisma.TransactionClient} client
 *        a Prisma client or an active $transaction client
 * @param {string|null|undefined} courseId
 * @param {string|null|undefined} formateurId
 */
export const linkFormateurToCourse = async (client, courseId, formateurId) => {
  if (!courseId || !formateurId) return;

  await client.courseInstructor.upsert({
    where: { courseId_userId: { courseId, userId: formateurId } },
    update: {},
    create: { courseId, userId: formateurId, role: 'group_formateur' },
  });
};
