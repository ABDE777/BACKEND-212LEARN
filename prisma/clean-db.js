/**
 * clean-db.js — reset the database to a clean launch state.
 *
 * Wipes ALL data (courses, enrollments, payments, messages, test users, …) and
 * keeps ONLY the platform admin accounts. Use this before going live to strip
 * the seed/test data.
 *
 * Admins kept: KEEP_ADMIN_EMAILS (comma-separated) or, by default, the two
 * accounts created by the seed script.
 *
 * SAFETY: destructive. It refuses to run unless you pass `--yes` (or set
 * CONFIRM_CLEAN=yes). Without it, it prints what it would delete and exits.
 *
 *   node prisma/clean-db.js            # dry run (prints plan, deletes nothing)
 *   node prisma/clean-db.js --yes      # actually wipe
 *   npm run db:clean -- --yes          # via npm script
 */
import prisma from '../src/config/prisma.js';

const DEFAULT_ADMINS = [
  'ibrahim.challal@212learn.com',
  'abdelmonim.mazguora@212learn.com',
];

const keepAdminEmails = (process.env.KEEP_ADMIN_EMAILS
  ? process.env.KEEP_ADMIN_EMAILS.split(',')
  : DEFAULT_ADMINS
).map((e) => e.trim().toLowerCase()).filter(Boolean);

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
  console.log('\n🧹 212Learn — nettoyage de la base de données\n');

  const admins = await prisma.user.findMany({
    where: { email: { in: keepAdminEmails }, role: 'admin' },
    select: { id: true, email: true },
  });
  const keepIds = admins.map((a) => a.id);
  const totalUsers = await prisma.user.count();

  console.log('Admins conservés :');
  keepAdminEmails.forEach((e) => {
    const found = admins.find((a) => a.email.toLowerCase() === e);
    console.log(`  ${found ? '✓' : '✗ (introuvable)'} ${e}`);
  });
  console.log(`\nUtilisateurs à supprimer : ${totalUsers - admins.length} / ${totalUsers}`);
  console.log(`Tables entièrement vidées : ${WIPE_ORDER.length}\n`);

  if (admins.length === 0) {
    console.warn('⚠️  Aucun admin trouvé — la base pourrait se retrouver SANS utilisateur.');
    console.warn('    Relancez le seed (étape admin) après le nettoyage, ou vérifiez KEEP_ADMIN_EMAILS.\n');
  }

  if (!confirmed) {
    console.log('DRY RUN — rien n\'a été supprimé.');
    console.log('Pour exécuter réellement : node prisma/clean-db.js --yes\n');
    return;
  }

  console.log('Suppression en cours…\n');
  for (const model of WIPE_ORDER) {
    const res = await prisma[model].deleteMany({});
    if (res.count > 0) console.log(`  - ${model}: ${res.count} supprimé(s)`);
  }

  const del = await prisma.user.deleteMany({
    where: keepIds.length ? { id: { notIn: keepIds } } : {},
  });
  console.log(`  - user: ${del.count} supprimé(s)`);

  const remaining = await prisma.user.findMany({ select: { email: true, role: true } });
  console.log('\n✅ Nettoyage terminé.');
  console.log(`Utilisateurs restants (${remaining.length}) :`);
  remaining.forEach((u) => console.log(`  • ${u.email} [${u.role}]`));
  console.log('');
}

main()
  .catch((err) => {
    console.error('\n❌ Échec du nettoyage :', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
