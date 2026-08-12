/**
 * Lean test seed for 212LEARN.
 * Creates only enough data to exercise auth, curriculum, paywall, quiz, and admin flows.
 *
 * All accounts use password: password123
 * NOTE: this is a pre-launch TEST seeder. Remove it and create a real admin
 * directly in the database before launch.
 */
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

const PASSWORD = 'password123';

async function clearAll() {
  console.log('🧹 Clearing tables...');
  await prisma.auditLog.deleteMany();
  await prisma.groupStudent.deleteMany();
  await prisma.group.deleteMany();
  await prisma.meeting.deleteMany();
  await prisma.certificate.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badgeDefinition.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.review.deleteMany();
  await prisma.lessonProgress.deleteMany();
  await prisma.quizAttempt.deleteMany();
  await prisma.question.deleteMany();
  await prisma.quiz.deleteMany();
  await prisma.coupon.deleteMany();
  await prisma.wishlist.deleteMany();
  await prisma.cartItem.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.enrollment.deleteMany();
  await prisma.submission.deleteMany();
  await prisma.assignment.deleteMany();
  await prisma.resource.deleteMany();
  await prisma.lesson.deleteMany();
  await prisma.section.deleteMany();
  await prisma.courseInstructor.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.instructorProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('🌱 Seeding lean test data...');
  await clearAll();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── Users ──────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: '212',
      email: 'admin@212learn.com',
      passwordHash,
      role: 'admin',
      isVerified: true,
      bio: 'Platform administrator',
    },
  });

  const instructor = await prisma.user.create({
    data: {
      firstName: 'Sara',
      lastName: 'Instructor',
      email: 'instructor@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Lead web development instructor',
      phone: '+212600000001',
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructor.id,
      situation: 'employed',
      expertiseDomain: 'Web Development',
      specialization: 'React & Node.js',
      organization: '212Learn',
      department: 'IT',
      position: 'Lead Web Development Instructor',
      sector: 'Technology',
      experienceYears: '3-5',
      teachingMode: 'online',
      teachingDomains: 'JavaScript, React, Node.js, PHP',
    },
  });

  const student1 = await prisma.user.create({
    data: {
      firstName: 'Youssef',
      lastName: 'Student',
      email: 'student1@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      phone: '+212600000002',
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: student1.id,
      situation: 'student',
      school: 'ISFO Sidi Maarouf',
      fieldOfStudy: 'Développement Digital',
      educationLevel: 'Bac+2',
      academicYearStart: new Date('2025-09-01'),
      academicYearEnd: new Date('2026-06-30'),
      group: null,
      isSelfDirected: false,
    },
  });

  const student2 = await prisma.user.create({
    data: {
      firstName: 'Amina',
      lastName: 'Learner',
      email: 'student2@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      phone: '+212600000003',
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: student2.id,
      situation: 'employee',
      school: null,
      fieldOfStudy: null,
      educationLevel: null,
      academicYearStart: null,
      academicYearEnd: null,
      companyName: 'ABC Maroc',
      department: 'IT',
      position: 'Développeur Web',
      sector: 'Technologie',
      experienceYears: '1-2',
      group: null,
      isSelfDirected: false,
    },
  });

  // ── Categories ─────────────────────────────────────────────────────────────
  const development = await prisma.category.create({
    data: {
      name: 'Development',
      description: 'Programming and software engineering',
    },
  });

  const webDev = await prisma.category.create({
    data: {
      name: 'Web Development',
      description: 'HTML, CSS, JavaScript, React, Node.js',
      parentId: development.id,
    },
  });

  // ── Course A: published, paid (main test course) ────────────────────────────
  const courseReact = await prisma.course.create({
    data: {
      categoryId: webDev.id,
      title: 'React Essentials',
      description: 'Learn React fundamentals with practical lessons and a quiz.',
      price: 299.0,
      level: 'beginner',
      language: 'french',
      duration: 480,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=600&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: {
      courseId: courseReact.id,
      userId: instructor.id,
      role: 'lead_instructor',
    },
  });

  const section1 = await prisma.section.create({
    data: { courseId: courseReact.id, title: 'Getting Started', position: 1 },
  });
  const section2 = await prisma.section.create({
    data: { courseId: courseReact.id, title: 'Components & State', position: 2 },
  });

  const lesson1 = await prisma.lesson.create({
    data: { sectionId: section1.id, title: 'What is React?', position: 1 },
  });
  const lesson2 = await prisma.lesson.create({
    data: { sectionId: section1.id, title: 'Project Setup', position: 2 },
  });
  const lesson3 = await prisma.lesson.create({
    data: { sectionId: section2.id, title: 'useState Hook', position: 1 },
  });

  // External links only (no Cloudinary files in seed)
  await prisma.resource.createMany({
    data: [
      {
        lessonId: lesson1.id,
        type: 'link',
        url: 'https://react.dev/learn',
      },
      {
        lessonId: lesson2.id,
        type: 'link',
        url: 'https://vitejs.dev/guide/',
      },
      {
        lessonId: lesson3.id,
        type: 'link',
        url: 'https://react.dev/reference/react/useState',
      },
    ],
  });

  await prisma.assignment.create({
    data: {
      lessonId: lesson3.id,
      title: 'Build a counter with useState',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson3.id,
      title: 'useState Basics Quiz',
      validationStatus: 'approved',
    },
  });

  await prisma.question.createMany({
    data: [
      {
        quizId: quiz.id,
        statement: 'What does useState return?',
        options: ['A value only', 'A setter only', 'A value and a setter', 'A ref object'],
        correctAnswer: 'A value and a setter',
      },
      {
        quizId: quiz.id,
        statement: 'How do you update state correctly?',
        options: [
          'Mutate the variable directly',
          'Call the setter function',
          'Edit localStorage',
          'Reload the page',
        ],
        correctAnswer: 'Call the setter function',
      },
    ],
  });

  // student1 = PAID access
  const enrollmentPaid = await prisma.enrollment.create({
    data: { userId: student1.id, courseId: courseReact.id },
  });
  await prisma.payment.create({
    data: {
      enrollmentId: enrollmentPaid.id,
      amount: 299.0,
      currency: 'MAD',
      provider: 'wafacash',
      transactionReference: 'WFC-TESTPAID',
      status: 'PAID',
      paidAt: new Date(),
      mtcn: '1234567890',
      verifiedBy: admin.id,
      verifiedAt: new Date(),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      userId: student1.id,
      lessonId: lesson1.id,
      completed: true,
      videoPosition: 0,
      timeSpent: 600,
      completedAt: new Date(),
    },
  });

  await prisma.review.create({
    data: {
      userId: student1.id,
      courseId: courseReact.id,
      rating: 5,
      comment: 'Clear and practical intro to React.',
    },
  });

  // student2 = PENDING payment (for Wafacash flow testing)
  const enrollmentPending = await prisma.enrollment.create({
    data: { userId: student2.id, courseId: courseReact.id },
  });
  await prisma.payment.create({
    data: {
      enrollmentId: enrollmentPending.id,
      amount: 269.1,
      currency: 'MAD',
      provider: 'wafacash',
      transactionReference: 'WFC-TESTPEND',
      status: 'PENDING',
    },
  });

  // ── Course B: published, free (catalog browsing test) ───────────────────────
  const courseJs = await prisma.course.create({
    data: {
      categoryId: webDev.id,
      title: 'JavaScript Basics',
      description: 'Short published course for catalog browsing tests.',
      price: 0,
      level: 'beginner',
      language: 'french',
      duration: 120,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=600&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: {
      courseId: courseJs.id,
      userId: instructor.id,
      role: 'lead_instructor',
    },
  });

  const jsSection = await prisma.section.create({
    data: { courseId: courseJs.id, title: 'Basics', position: 1 },
  });
  await prisma.lesson.create({
    data: { sectionId: jsSection.id, title: 'Variables & Types', position: 1 },
  });

  // ── Commerce / gamification extras ─────────────────────────────────────────
  await prisma.coupon.create({
    data: {
      code: 'TEST10',
      discount: 10,
      expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      maxUsage: 100,
      currentUsage: 0,
      isActive: true,
    },
  });

  await prisma.badgeDefinition.createMany({
    data: [
      { name: 'First Steps', description: 'Complete your first lesson', icon: '👣' },
      { name: 'Quiz Master', description: 'Pass a quiz with 80%+', icon: '🧠' },
      { name: 'Course Finisher', description: 'Complete a full course', icon: '🎓' },
    ],
  });

  await prisma.meeting.create({
    data: {
      courseId: courseReact.id,
      title: 'Live Q&A — React Essentials',
      meetingUrl: 'https://meet.google.com/test-react-qa',
      meetingDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      roomName: '212learn-react-qa-scheduled',
      status: 'SCHEDULED',
      durationMinutes: 60,
      recordingUrl: null,
    },
  });

  await prisma.notification.create({
    data: {
      userId: student1.id,
      content: 'Welcome! Your React Essentials enrollment is active.',
      isRead: false,
    },
  });

  console.log('\n✅ Seed complete (lean test dataset)\n');
  console.log('Accounts (password for all: password123)');
  console.log('  admin@212learn.com');
  console.log('  instructor@212learn.com');
  console.log('  student1@212learn.com  → PAID on React Essentials');
  console.log('  student2@212learn.com  → PENDING Wafacash (ref WFC-TESTPEND)');
  console.log('\nCoupon: TEST10 (10%)');
  console.log(`Courses: ${courseReact.title} (${courseReact.id}), ${courseJs.title}`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
