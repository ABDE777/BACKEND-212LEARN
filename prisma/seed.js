import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean up existing data in reverse order of dependencies
  console.log('🧹 Clearing existing data...');
  await prisma.meeting.deleteMany({});
  await prisma.certificate.deleteMany({});
  await prisma.userBadge.deleteMany({});
  await prisma.badgeDefinition.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.review.deleteMany({});
  await prisma.lessonProgress.deleteMany({});
  await prisma.quizAttempt.deleteMany({});
  await prisma.question.deleteMany({});
  await prisma.quiz.deleteMany({});
  await prisma.coupon.deleteMany({});
  await prisma.wishlist.deleteMany({});
  await prisma.cartItem.deleteMany({});
  await prisma.cart.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.enrollment.deleteMany({});
  await prisma.submission.deleteMany({});
  await prisma.assignment.deleteMany({});
  await prisma.resource.deleteMany({});
  await prisma.lesson.deleteMany({});
  await prisma.section.deleteMany({});
  await prisma.courseInstructor.deleteMany({});
  await prisma.course.deleteMany({});
  await prisma.category.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('✅ Clean up complete.');

  // 2. Hash passwords
  const passwordHash = await bcrypt.hash('password123', 10);

  // 3. Create Users
  console.log('👤 Seeding Users...');
  const admin = await prisma.user.create({
    data: {
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@212learn.com',
      passwordHash,
      role: 'admin',
      isVerified: true,
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Head Administrator of 212LEARN.',
    },
  });

  const instructor = await prisma.user.create({
    data: {
      firstName: 'Alex',
      lastName: 'Instructor',
      email: 'instructor@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Senior Software Engineer and Pedagogical Lead.',
    },
  });

  const student = await prisma.user.create({
    data: {
      firstName: 'Sarah',
      lastName: 'Student',
      email: 'student@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&h=150&q=80',
      bio: 'Lifelong learner interested in full-stack engineering.',
    },
  });

  // 4. Create Categories
  console.log('📂 Seeding Categories...');
  const devCategory = await prisma.category.create({
    data: {
      name: 'Development',
      description: 'Programming, web apps, databases, and scripting.',
    },
  });

  const webDevCategory = await prisma.category.create({
    data: {
      name: 'Web Development',
      description: 'HTML, CSS, JavaScript, React, Node.js.',
      parentId: devCategory.id,
    },
  });

  const designCategory = await prisma.category.create({
    data: {
      name: 'Design',
      description: 'UI/UX design, visual illustration, and prototyping.',
    },
  });

  // 5. Create Courses
  console.log('📚 Seeding Courses...');
  const reactCourse = await prisma.course.create({
    data: {
      categoryId: webDevCategory.id,
      title: 'React from Zero to Hero',
      description: 'Master React, hooks, state management, and production deployments.',
      price: 49.99,
      level: 'intermediate',
      language: 'french',
      duration: 1200, // 20 hours
      status: 'active',
    },
  });

  // 6. Connect Course & Instructor
  await prisma.courseInstructor.create({
    data: {
      courseId: reactCourse.id,
      userId: instructor.id,
      role: 'lead_instructor',
    },
  });

  // 7. Create Course Structure (Sections & Lessons)
  console.log('📑 Seeding Sections & Lessons...');
  const section1 = await prisma.section.create({
    data: {
      courseId: reactCourse.id,
      title: 'Introduction to React',
      position: 1,
    },
  });

  const lesson1 = await prisma.lesson.create({
    data: {
      sectionId: section1.id,
      title: 'Welcome & Environment Setup',
      position: 1,
    },
  });

  const lesson2 = await prisma.lesson.create({
    data: {
      sectionId: section1.id,
      title: 'Understanding JSX & Elements',
      position: 2,
    },
  });

  const section2 = await prisma.section.create({
    data: {
      courseId: reactCourse.id,
      title: 'Hooks and State Management',
      position: 2,
    },
  });

  const lesson3 = await prisma.lesson.create({
    data: {
      sectionId: section2.id,
      title: 'Deep Dive into useState',
      position: 1,
    },
  });

  // 8. Create Resources
  console.log('🔗 Seeding Resources...');
  await prisma.resource.create({
    data: {
      lessonId: lesson1.id,
      type: 'Video',
      url: 'https://res.cloudinary.com/demo/video/upload/dog.mp4',
    },
  });

  await prisma.resource.create({
    data: {
      lessonId: lesson1.id,
      type: 'PDF',
      url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
    },
  });

  // 9. Create Assignments & Submissions
  console.log('📝 Seeding Assignments & Submissions...');
  const assignment = await prisma.assignment.create({
    data: {
      lessonId: lesson2.id,
      title: 'Build your first JSX page',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
    },
  });

  const submission = await prisma.submission.create({
    data: {
      assignmentId: assignment.id,
      userId: student.id,
      fileUrl: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      grade: 95.0,
      feedback: 'Excellent clean JSX implementation!',
    },
  });

  // 10. Create Coupons
  console.log('🎫 Seeding Coupons...');
  const coupon = await prisma.coupon.create({
    data: {
      code: 'WELCOME20',
      discount: 20.00, // 20% off
      expirationDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // 11. Create Enrollments & Payments
  console.log('💳 Seeding Enrollments & Payments...');
  const enrollment = await prisma.enrollment.create({
    data: {
      userId: student.id,
      courseId: reactCourse.id,
    },
  });

  await prisma.payment.create({
    data: {
      enrollmentId: enrollment.id,
      amount: 39.99, // discounted
      currency: 'USD',
      provider: 'stripe',
      transactionReference: 'ch_stripe_mock_12345',
      status: 'paid',
      paidAt: new Date(),
      couponId: coupon.id,
    },
  });

  // 12. Create Cart & Items
  console.log('🛒 Seeding Cart...');
  const cart = await prisma.cart.create({
    data: {
      userId: student.id,
    },
  });

  await prisma.cartItem.create({
    data: {
      cartId: cart.id,
      courseId: reactCourse.id,
    },
  });

  // 13. Create Wishlist
  console.log('❤️ Seeding Wishlist...');
  await prisma.wishlist.create({
    data: {
      userId: student.id,
      courseId: reactCourse.id,
    },
  });

  // 14. Create Quizzes, Questions, Attempts
  console.log('❓ Seeding Quizzes & Attempts...');
  const quiz = await prisma.quiz.create({
    data: {
      lessonId: lesson3.id,
      title: 'useState MCQ Quiz',
      validationStatus: 'approved',
    },
  });

  const question1 = await prisma.question.create({
    data: {
      quizId: quiz.id,
      statement: 'What does useState return?',
      correctAnswer: 'An array with two elements: the state and a function to update it.',
    },
  });

  await prisma.quizAttempt.create({
    data: {
      quizId: quiz.id,
      userId: student.id,
      score: 100.0,
      duration: 120, // 2 mins
    },
  });

  // 15. Create Lesson Progresses
  console.log('📈 Seeding Lesson Progress...');
  await prisma.lessonProgress.create({
    data: {
      userId: student.id,
      lessonId: lesson1.id,
      completed: true,
      videoPosition: 420, // 7 mins
      timeSpent: 500,
      completedAt: new Date(),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      userId: student.id,
      lessonId: lesson2.id,
      completed: false,
      videoPosition: 120,
      timeSpent: 200,
    },
  });

  // 16. Create Reviews
  console.log('⭐ Seeding Reviews...');
  await prisma.review.create({
    data: {
      userId: student.id,
      courseId: reactCourse.id,
      rating: 5,
      comment: 'Absolutely amazing explanations! Perfect intermediate course.',
    },
  });

  // 17. Create Notifications
  console.log('🔔 Seeding Notifications...');
  await prisma.notification.create({
    data: {
      userId: student.id,
      content: 'Welcome to React from Zero to Hero! Your lead instructor is Alex.',
      isRead: false,
    },
  });

  // 18. Create Gamification Badges
  console.log('🏆 Seeding Badges & Certificates...');
  const badgeDef = await prisma.badgeDefinition.create({
    data: {
      name: 'React Beginner',
      description: 'Completed the React Introduction section.',
      icon: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=100&h=100&q=80',
    },
  });

  await prisma.userBadge.create({
    data: {
      userId: student.id,
      badgeDefinitionId: badgeDef.id,
    },
  });

  // 19. Create Certificates
  await prisma.certificate.create({
    data: {
      userId: student.id,
      courseId: reactCourse.id,
      certificateNumber: 'CERT-REACT-777888999',
    },
  });

  // 20. Create Meetings
  console.log('📅 Seeding Meetings...');
  await prisma.meeting.create({
    data: {
      courseId: reactCourse.id,
      title: 'React Live Q&A Session',
      meetingUrl: 'https://zoom.us/j/123456789',
      meetingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
    },
  });

  console.log('🎉 Seeding successfully completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
