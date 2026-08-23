/**
 * create-admins.js — Create platform admin accounts.
 *
 * This script creates the two default admin accounts for the platform.
 * Run this after cleaning the database to restore admin access.
 *
 * Usage:
 *   node prisma/create-admins.js
 *   npm run db:create-admins
 */
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

const ADMINS = [
  {
    email: 'ibrahim.challal@212learn.com',
    firstName: 'Ibrahim',
    lastName: 'Challal',
    password: 'password123',
    role: 'admin',
  },
  {
    email: 'abdelmonim.mazguora@212learn.com',
    firstName: 'Abdelmonim',
    lastName: 'Mazguora',
    password: 'password123',
    role: 'admin',
  },
];

async function main() {
  console.log('\n👤 212Learn — Création des comptes administrateurs\n');

  for (const admin of ADMINS) {
    const existing = await prisma.user.findUnique({
      where: { email: admin.email },
    });

    if (existing) {
      console.log(`⚠️  Admin déjà existant : ${admin.email}`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 10);

    const user = await prisma.user.create({
      data: {
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        passwordHash,
        role: admin.role,
        isVerified: true,
      },
    });

    console.log(`✅ Admin créé : ${user.email}`);
  }

  console.log('\n✅ Terminé. Les administrateurs peuvent maintenant se connecter.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Échec de la création des admins :', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
