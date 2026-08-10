import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function countUsers() {
  const [
    students, studentsVerified, studentsUnverified,
    instructors, instructorsVerified, instructorsUnverified,
    admins, adminsVerified, adminsUnverified,
    total, totalVerified, totalUnverified,
  ] = await Promise.all([
    prisma.user.count({ where: { role: 'student' } }),
    prisma.user.count({ where: { role: 'student', isVerified: true } }),
    prisma.user.count({ where: { role: 'student', isVerified: false } }),

    prisma.user.count({ where: { role: 'instructor' } }),
    prisma.user.count({ where: { role: 'instructor', isVerified: true } }),
    prisma.user.count({ where: { role: 'instructor', isVerified: false } }),

    prisma.user.count({ where: { role: 'admin' } }),
    prisma.user.count({ where: { role: 'admin', isVerified: true } }),
    prisma.user.count({ where: { role: 'admin', isVerified: false } }),

    prisma.user.count(),
    prisma.user.count({ where: { isVerified: true } }),
    prisma.user.count({ where: { isVerified: false } }),
  ]);

  console.log('\n📊 ===== USER COUNT IN DATABASE =====');
  console.log(`🎓 Étudiants   : ${students}  ✅ Vérifiés: ${studentsVerified}  ❌ Non vérifiés: ${studentsUnverified}`);
  console.log(`👨‍🏫 Instructeurs : ${instructors}  ✅ Vérifiés: ${instructorsVerified}  ❌ Non vérifiés: ${instructorsUnverified}`);
  console.log(`🛡️  Admins       : ${admins}  ✅ Vérifiés: ${adminsVerified}  ❌ Non vérifiés: ${adminsUnverified}`);
  console.log(`────────────────────────────────────`);
  console.log(`👥 TOTAL        : ${total}  ✅ Vérifiés: ${totalVerified}  ❌ Non vérifiés: ${totalUnverified}`);
  console.log('=====================================\n');

  await prisma.$disconnect();
  await pool.end();
}

countUsers().catch((err) => {
  console.error('❌ Erreur:', err.message);
  process.exit(1);
});
