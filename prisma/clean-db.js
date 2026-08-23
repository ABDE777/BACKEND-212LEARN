/**
 * clean-db.js — reset the database to a clean launch state.
 *
 * Wipes ALL data (courses, enrollments, payments, messages, test users, …) including
 * ALL admin accounts. Use this before going live to strip the seed/test data.
 *
 * After running this, use `npm run db:create-admins` to recreate the admin accounts.
 *
 * SAFETY: destructive. It refuses to run unless you pass `--yes` (or set
 * CONFIRM_CLEAN=yes). Without it, it prints what it would delete and exits.
 *
 *   node prisma/clean-db.js            # dry run (prints plan, deletes nothing)
 *   node prisma/clean-db.js --yes      # actually wipe
 *   npm run db:clean -- --yes          # via npm script
 */
import prisma from '../src/config/prisma.js';

const confirmed =
  process.argv.includes('--yes') ||
  String(process.env.CONFIRM_CLEAN).toLowerCase() === 'yes';

// Every table wiped fully, ordered children → parents so foreign keys never block.
// (Most also cascade, but the explicit order keeps it safe regardless.)
const WIPE_ORDER = [
  'groupChatMessage',
  'groupStudent',
  'group',
  'submission',
  'assignment',
  'quizAttempt',
  'question',
  'quiz',
  'resource',
  'lessonProgress',
  'lesson',
  'section',
  'payment',
  'enrollment',
  'cartItem',
  'cart',
  'wishlist',
  'review',
  'certificate',
  'meeting',
  'coupon',
  'courseInstructor',
  'courseUpdateRequest',
  'userBadge',
  'notification',
  'auditLog',
  'studentProfile',
  'instructorProfile',
  'course',
  'category',
  'badgeDefinition',
  'contactMessage',
  'appSetting',
];

async function main() {
  console.log('\n🧹 212Learn — nettoyage complet de la base de données\n');

  const totalUsers = await prisma.user.count();
  console.log(`Utilisateurs à supprimer : ${totalUsers}`);
  console.log(`Tables entièrement vidées : ${WIPE_ORDER.length}\n`);

  if (!confirmed) {
    console.log('DRY RUN — rien n\'a été supprimé.');
    console.log('Pour exécuter réellement : node prisma/clean-db.js --yes\n');
    console.log('⚠️  Tous les utilisateurs (y compris les admins) seront supprimés.');
    console.log('Après le nettoyage, exécutez : npm run db:create-admins\n');
    return;
  }

  console.log('Suppression en cours…\n');
  for (const model of WIPE_ORDER) {
    const res = await prisma[model].deleteMany({});
    if (res.count > 0) console.log(`  - ${model}: ${res.count} supprimé(s)`);
  }

  const del = await prisma.user.deleteMany({});
  console.log(`  - user: ${del.count} supprimé(s)`);

  console.log('\n✅ Nettoyage terminé. Tous les utilisateurs ont été supprimés.');
  console.log('Pour recréer les admins, exécutez : npm run db:create-admins\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Échec du nettoyage :', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
