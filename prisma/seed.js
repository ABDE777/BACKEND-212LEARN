import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

// Helper functions for generating test data
const firstNames = ['Ahmed', 'Sarah', 'Mohammed', 'Fatima', 'Youssef', 'Amina', 'Omar', 'Layla', 'Karim', 'Nour', 'Hassan', 'Zara', 'Amir', 'Leila', 'Khalid', 'Sana', 'Tariq', 'Hana', 'Walid', 'Rania', 'Samir', 'Nadia', 'Fares', 'Yasmin', 'Bilal', 'Salma', 'Hamza', 'Mona', 'Ibrahim', 'Dalia', 'Mahdi', 'Rasha', 'Ziad', 'Amira', 'Karim', 'Lina', 'Taha', 'Hajar', 'Mounir', 'Samar'];
const lastNames = ['Benali', 'Chadli', 'Dahmani', 'El Fassi', 'Ghanmi', 'Hammoud', 'Idrissi', 'Jazouli', 'Kabbouri', 'Lamrani', 'Mansouri', 'Najdi', 'Ouazzani', 'Rafiq', 'Slaoui', 'Tazi', 'Zerhouni', 'Bensalem', 'Chraibi', 'Drissi', 'El Amrani', 'Fassi', 'Ghali', 'Hilali', 'Idrissi', 'Jelloul', 'Kaddouri', 'Laraki', 'Moussaoui', 'Naciri', 'Ouahmane', 'Rahmani', 'Sefrioui', 'Toubal', 'Zahraoui', 'Benaissa', 'Chahdi', 'Driouch', 'El Idrissi', 'Gharbaoui'];

const courseTitles = [
  'React from Zero to Hero', 'Advanced JavaScript Patterns', 'Node.js Masterclass', 'Python for Data Science',
  'Machine Learning Fundamentals', 'UI/UX Design Principles', 'Docker & Kubernetes Essentials', 'AWS Cloud Practitioner',
  'Cybersecurity Basics', 'Mobile App Development with Flutter', 'Vue.js Complete Guide', 'Angular Best Practices',
  'TypeScript Deep Dive', 'GraphQL with React', 'RESTful API Design', 'MongoDB Database Design',
  'SQL Mastery', 'Git & GitHub Workflow', 'Agile Project Management', 'DevOps Fundamentals',
  'Linux System Administration', 'Network Security', 'Web Performance Optimization', 'Testing Strategies',
  'Microservices Architecture', 'Serverless Computing', 'Blockchain Development', 'Game Development with Unity',
  'iOS Development with Swift', 'Android Development with Kotlin'
];

const courseDescriptions = [
  'Master modern development techniques and build production-ready applications.',
  'Learn from industry experts with hands-on projects and real-world examples.',
  'Comprehensive curriculum covering theory and practical implementation.',
  'Step-by-step guidance from beginner to advanced level concepts.',
  'Focus on best practices and industry standards for professional development.'
];

const lessonTitles = [
  'Introduction & Setup', 'Core Concepts', 'Advanced Techniques', 'Best Practices',
  'Real-world Examples', 'Performance Optimization', 'Security Considerations', 'Testing Strategies',
  'Deployment Guide', 'Troubleshooting Common Issues', 'Integration Patterns', 'Scaling Strategies',
  'Monitoring & Debugging', 'API Design', 'Database Design', 'Frontend Architecture',
  'Backend Development', 'DevOps Integration', 'Security Implementation', 'Performance Tuning'
];

const quizQuestions = [
  { statement: 'What is the primary purpose of this concept?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option A' },
  { statement: 'Which of the following is a best practice?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option B' },
  { statement: 'What happens when you use this approach?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option C' },
  { statement: 'Which tool is commonly used for this task?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option D' },
  { statement: 'What is the main advantage of this method?', options: ['Option A', 'Option B', 'Option C', 'Option D'], correct: 'Option A' }
];

const notificationContents = [
  'Welcome to your new course! Start learning today.',
  'Your assignment has been graded. Check your feedback.',
  'New lesson available in your enrolled course.',
  'Don\'t forget to complete your quiz before the deadline.',
  'Congratulations on completing a section!',
  'Your instructor has posted a new announcement.',
  'Course materials have been updated.',
  'Live session scheduled for tomorrow.',
  'Your certificate is ready for download.',
  'New badge earned! Keep up the great work.'
];

const reviewComments = [
  'Excellent course with great explanations!',
  'Very comprehensive and well-structured.',
  'Learned a lot from this course. Highly recommended.',
  'Good content but could use more examples.',
  'Perfect for beginners. Clear and concise.',
  'Advanced topics covered in depth. Great value.',
  'Instructor is very knowledgeable and helpful.',
  'Practical projects were very useful.',
  'Could improve the pacing of some lessons.',
  'Overall a great learning experience.'
];

function getRandomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function getRandomItems(array, count) {
  const shuffled = [...array].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomFloat(min, max, decimals = 2) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function getRandomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log('🌱 Starting database seeding...');

  // 1. Clean up existing data in reverse order of dependencies
  console.log('🧹 Clearing existing data...');
  await prisma.auditLog.deleteMany({});
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

  // 3. Create Users (50+ users)
  console.log('👤 Seeding Users...');
  const users = [];
  
  // Create admin users
  for (let i = 0; i < 3; i++) {
    const user = await prisma.user.create({
      data: {
        firstName: firstNames[i],
        lastName: lastNames[i],
        email: `admin${i + 1}@212learn.com`,
        passwordHash,
        role: 'admin',
        isVerified: true,
        avatar: `https://images.unsplash.com/photo-${1500000000000 + i}?auto=format&fit=crop&w=150&h=150&q=80`,
        bio: `Administrator ${i + 1} - Managing platform operations.`,
      },
    });
    users.push(user);
  }
  
  // Create instructor users
  for (let i = 0; i < 12; i++) {
    const user = await prisma.user.create({
      data: {
        firstName: firstNames[(i + 3) % firstNames.length],
        lastName: lastNames[(i + 3) % lastNames.length],
        email: `instructor${i + 1}@212learn.com`,
        passwordHash,
        role: 'instructor',
        isVerified: true,
        avatar: `https://images.unsplash.com/photo-${1500000000000 + i + 10}?auto=format&fit=crop&w=150&h=150&q=80`,
        bio: `Expert instructor specializing in ${getRandomItem(['Web Development', 'Data Science', 'Mobile Development', 'DevOps', 'UI/UX Design', 'Cybersecurity'])}.`,
      },
    });
    users.push(user);
  }
  
  // Create student users
  for (let i = 0; i < 40; i++) {
    const user = await prisma.user.create({
      data: {
        firstName: firstNames[(i + 15) % firstNames.length],
        lastName: lastNames[(i + 15) % lastNames.length],
        email: `student${i + 1}@212learn.com`,
        passwordHash,
        role: 'student',
        isVerified: Math.random() > 0.2, // 80% verified
        avatar: `https://images.unsplash.com/photo-${1500000000000 + i + 20}?auto=format&fit=crop&w=150&h=150&q=80`,
        bio: getRandomItem([
          'Passionate learner exploring new technologies.',
          'Career changer transitioning to tech.',
          'Student looking to expand skill set.',
          'Professional seeking upskilling opportunities.',
          'Enthusiastic about continuous learning.'
        ]),
        lastLogin: Math.random() > 0.3 ? getRandomDate(new Date(2024, 0, 1), new Date()) : null,
      },
    });
    users.push(user);
  }
  
  const [admin, ...instructors] = users;
  const students = users.slice(15);

  // 4. Create Categories (hierarchical structure)
  console.log('📂 Seeding Categories...');
  const categories = [];
  
  // Main categories
  const mainCategories = [
    { name: 'Development', description: 'Programming, web apps, databases, and scripting.' },
    { name: 'Design', description: 'UI/UX design, visual illustration, and prototyping.' },
    { name: 'Business', description: 'Management, marketing, and entrepreneurship.' },
    { name: 'Data Science', description: 'Machine learning, analytics, and data visualization.' },
    { name: 'DevOps', description: 'Infrastructure, deployment, and operations.' },
    { name: 'Mobile Development', description: 'iOS, Android, and cross-platform development.' }
  ];
  
  for (const cat of mainCategories) {
    const category = await prisma.category.create({
      data: cat,
    });
    categories.push(category);
  }
  
  // Subcategories for Development
  const devSubcategories = [
    { name: 'Web Development', description: 'HTML, CSS, JavaScript, React, Node.js.', parentId: categories[0].id },
    { name: 'Backend Development', description: 'Server-side programming, APIs, databases.', parentId: categories[0].id },
    { name: 'Frontend Development', description: 'User interfaces, frameworks, styling.', parentId: categories[0].id },
    { name: 'Full Stack Development', description: 'End-to-end application development.', parentId: categories[0].id }
  ];
  
  for (const sub of devSubcategories) {
    const subcategory = await prisma.category.create({ data: sub });
    categories.push(subcategory);
  }
  
  // Subcategories for Design
  const designSubcategories = [
    { name: 'UI Design', description: 'User interface design and prototyping.', parentId: categories[1].id },
    { name: 'UX Design', description: 'User experience and research.', parentId: categories[1].id },
    { name: 'Graphic Design', description: 'Visual design and branding.', parentId: categories[1].id }
  ];
  
  for (const sub of designSubcategories) {
    const subcategory = await prisma.category.create({ data: sub });
    categories.push(subcategory);
  }

  // 5. Create Courses (30 courses)
  console.log('📚 Seeding Courses...');
  const courses = [];
  
  for (let i = 0; i < 30; i++) {
    const category = getRandomItem(categories);
    const course = await prisma.course.create({
      data: {
        categoryId: category.id,
        title: courseTitles[i % courseTitles.length],
        description: getRandomItem(courseDescriptions),
        price: getRandomFloat(19.99, 199.99),
        level: getRandomItem(['beginner', 'intermediate', 'advanced']),
        language: getRandomItem(['french', 'english', 'arabic']),
        duration: getRandomInt(300, 3600), // 5 to 60 hours
        status: getRandomItem(['draft', 'published', 'archived']),
      },
    });
    courses.push(course);
  }
  
  // 6. Connect Courses & Instructors
  console.log('👨‍🏫 Connecting Courses & Instructors...');
  for (const course of courses) {
    const numInstructors = getRandomInt(1, 3);
    const selectedInstructors = getRandomItems(instructors.slice(0, 12), numInstructors);
    
    for (let i = 0; i < selectedInstructors.length; i++) {
      await prisma.courseInstructor.create({
        data: {
          courseId: course.id,
          userId: selectedInstructors[i].id,
          role: i === 0 ? 'lead_instructor' : 'assistant_instructor',
        },
      });
    }
  }

  // 7. Create Course Structure (Sections & Lessons)
  console.log('📑 Seeding Sections & Lessons...');
  const allSections = [];
  const allLessons = [];
  
  for (const course of courses) {
    const numSections = getRandomInt(3, 8);
    
    for (let i = 0; i < numSections; i++) {
      const section = await prisma.section.create({
        data: {
          courseId: course.id,
          title: `Section ${i + 1}: ${getRandomItem(['Introduction', 'Core Concepts', 'Advanced Topics', 'Practical Applications', 'Best Practices', 'Case Studies', 'Final Project', 'Review'])}`,
          position: i + 1,
        },
      });
      allSections.push(section);
      
      const numLessons = getRandomInt(3, 10);
      for (let j = 0; j < numLessons; j++) {
        const lesson = await prisma.lesson.create({
          data: {
            sectionId: section.id,
            title: lessonTitles[j % lessonTitles.length],
            position: j + 1,
          },
        });
        allLessons.push(lesson);
      }
    }
  }

  // 8. Create Resources
  console.log('🔗 Seeding Resources...');
  const resourceTypes = ['Video', 'PDF', 'Code', 'Slide', 'Exercise', 'Solution'];
  
  for (const lesson of allLessons) {
    const numResources = getRandomInt(1, 4);
    for (let i = 0; i < numResources; i++) {
      await prisma.resource.create({
        data: {
          lessonId: lesson.id,
          type: getRandomItem(resourceTypes),
          url: `https://example.com/resources/${lesson.id}/${i}`,
        },
      });
    }
  }

  // 9. Create Assignments & Submissions
  console.log('📝 Seeding Assignments & Submissions...');
  const allAssignments = [];
  
  // Create assignments for lessons (30% of lessons have assignments)
  for (const lesson of allLessons.filter(() => Math.random() > 0.7)) {
    const assignment = await prisma.assignment.create({
      data: {
        lessonId: lesson.id,
        title: `Assignment: ${getRandomItem(['Project', 'Exercise', 'Case Study', 'Lab', 'Practical Task'])}`,
        dueDate: getRandomDate(new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      },
    });
    allAssignments.push(assignment);
  }
  
  // Create submissions for assignments
  for (const assignment of allAssignments) {
    const numSubmissions = getRandomInt(1, 15);
    const selectedStudents = getRandomItems(students, numSubmissions);
    
    for (const student of selectedStudents) {
      const isGraded = Math.random() > 0.4;
      await prisma.submission.create({
        data: {
          assignmentId: assignment.id,
          userId: student.id,
          fileUrl: `https://example.com/submissions/${assignment.id}/${student.id}`,
          grade: isGraded ? getRandomFloat(60, 100) : null,
          feedback: isGraded ? getRandomItem(['Excellent work!', 'Good effort, room for improvement.', 'Well done!', 'Great submission!', 'Needs some refinement.']) : null,
        },
      });
    }
  }

  // 10. Create Coupons
  console.log('🎫 Seeding Coupons...');
  const coupons = [];
  const couponCodes = ['WELCOME20', 'SAVE30', 'FLASH50', 'NEWUSER25', 'SUMMER15', 'WEEKEND40', 'LOYALTY35', 'FRIEND10'];
  
  for (let i = 0; i < 8; i++) {
    const coupon = await prisma.coupon.create({
      data: {
        code: couponCodes[i],
        discount: getRandomFloat(10, 50),
        expirationDate: getRandomDate(new Date(), new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)),
      },
    });
    coupons.push(coupon);
  }

  // 11. Create Enrollments & Payments
  console.log('💳 Seeding Enrollments & Payments...');
  const allEnrollments = [];
  const publishedCourses = courses.filter(c => c.status === 'published');
  
  // Each student enrolls in 2-6 courses
  for (const student of students) {
    const numEnrollments = getRandomInt(2, 6);
    const selectedCourses = getRandomItems(publishedCourses, numEnrollments);
    
    for (const course of selectedCourses) {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId: student.id,
          courseId: course.id,
          enrolledAt: getRandomDate(new Date(2024, 0, 1), new Date()),
        },
      });
      allEnrollments.push(enrollment);
      
      // Create payment for enrollment (80% have payments)
      if (Math.random() > 0.2) {
        const paymentStatus = getRandomItem(['PENDING', 'WAITING_VERIFICATION', 'PAID', 'REJECTED', 'REFUNDED']);
        const paymentData = {
          enrollmentId: enrollment.id,
          amount: course.price,
          currency: 'MAD',
          provider: getRandomItem(['wafacash', 'credit_card', 'paypal', 'bank_transfer']),
          transactionReference: `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          status: paymentStatus,
        };
        
        if (paymentStatus === 'PAID' || paymentStatus === 'REFUNDED') {
          paymentData.paidAt = getRandomDate(new Date(2024, 0, 1), new Date());
        }
        
        // 30% use coupons
        if (Math.random() > 0.7) {
          paymentData.couponId = getRandomItem(coupons).id;
        }
        
        // Wafacash specific fields
        if (paymentData.provider === 'wafacash') {
          paymentData.mtcn = `MTCN-${Math.random().toString(36).substr(2, 8).toUpperCase()}`;
          paymentData.receiptUrl = `https://receipts.wafacash.com/${paymentData.transactionReference}`;
          
          if (paymentStatus === 'PAID' && Math.random() > 0.5) {
            paymentData.verifiedBy = getRandomItem(instructors.slice(0, 3)).id;
            paymentData.verifiedAt = getRandomDate(paymentData.paidAt, new Date());
            paymentData.notes = 'Payment verified successfully';
          }
        }
        
        await prisma.payment.create({ data: paymentData });
      }
    }
  }

  // 12. Create Cart & Items
  console.log('🛒 Seeding Cart...');
  for (const student of students) {
    // 60% of students have active carts
    if (Math.random() > 0.4) {
      const cart = await prisma.cart.create({
        data: {
          userId: student.id,
        },
      });
      
      const numItems = getRandomInt(1, 5);
      const availableCourses = publishedCourses.filter(course => 
        !allEnrollments.some(e => e.courseId === course.id && e.userId === student.id)
      );
      const selectedCourses = getRandomItems(availableCourses, Math.min(numItems, availableCourses.length));
      
      for (const course of selectedCourses) {
        await prisma.cartItem.create({
          data: {
            cartId: cart.id,
            courseId: course.id,
          },
        });
      }
    }
  }

  // 13. Create Wishlist
  console.log('❤️ Seeding Wishlist...');
  for (const student of students) {
    const numWishlistItems = getRandomInt(1, 8);
    const availableCourses = publishedCourses.filter(course => 
      !allEnrollments.some(e => e.courseId === course.id && e.userId === student.id)
    );
    const selectedCourses = getRandomItems(availableCourses, Math.min(numWishlistItems, availableCourses.length));
    
    for (const course of selectedCourses) {
      await prisma.wishlist.create({
        data: {
          userId: student.id,
          courseId: course.id,
        },
      });
    }
  }

  // 14. Create Quizzes, Questions, Attempts
  console.log('❓ Seeding Quizzes & Attempts...');
  const allQuizzes = [];
  
  // Create quizzes for lessons (40% of lessons have quizzes)
  for (const lesson of allLessons.filter(() => Math.random() > 0.6)) {
    const quiz = await prisma.quiz.create({
      data: {
        lessonId: lesson.id,
        title: `Quiz: ${lesson.title}`,
        validationStatus: getRandomItem(['pending', 'approved', 'rejected']),
      },
    });
    allQuizzes.push(quiz);
    
    // Create questions for each quiz (3-8 questions)
    const numQuestions = getRandomInt(3, 8);
    for (let i = 0; i < numQuestions; i++) {
      const questionData = getRandomItem(quizQuestions);
      await prisma.question.create({
        data: {
          quizId: quiz.id,
          statement: questionData.statement,
          options: questionData.options,
          correctAnswer: questionData.correct,
        },
      });
    }
  }
  
  // Create quiz attempts for enrolled students
  for (const quiz of allQuizzes) {
    const numAttempts = getRandomInt(5, 20);
    const enrolledStudents = students.filter(student => 
      allEnrollments.some(e => e.userId === student.id)
    );
    const selectedStudents = getRandomItems(enrolledStudents, Math.min(numAttempts, enrolledStudents.length));
    
    for (const student of selectedStudents) {
      await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          userId: student.id,
          score: getRandomFloat(0, 100),
          duration: getRandomInt(60, 1800), // 1-30 minutes
          attemptDate: getRandomDate(new Date(2024, 0, 1), new Date()),
        },
      });
    }
  }

  // 15. Create Lesson Progresses
  console.log('📈 Seeding Lesson Progress...');
  
  for (const enrollment of allEnrollments) {
    const course = courses.find(c => c.id === enrollment.courseId);
    const courseLessons = allLessons.filter(lesson => {
      const section = allSections.find(s => s.id === lesson.sectionId);
      return section && section.courseId === course.id;
    });
    
    // Create progress for 60-90% of lessons
    const progressLessons = getRandomItems(courseLessons, Math.floor(courseLessons.length * getRandomFloat(0.6, 0.9)));
    
    for (const lesson of progressLessons) {
      const isCompleted = Math.random() > 0.4;
      await prisma.lessonProgress.create({
        data: {
          userId: enrollment.userId,
          lessonId: lesson.id,
          completed: isCompleted,
          videoPosition: getRandomInt(0, 3600),
          timeSpent: getRandomInt(60, 7200),
          startedAt: getRandomDate(new Date(2024, 0, 1), new Date()),
          completedAt: isCompleted ? getRandomDate(new Date(2024, 0, 1), new Date()) : null,
        },
      });
    }
  }

  // 16. Create Reviews
  console.log('⭐ Seeding Reviews...');
  
  // Create reviews for enrolled courses (50% of enrollments have reviews)
  for (const enrollment of allEnrollments.filter(() => Math.random() > 0.5)) {
    await prisma.review.create({
      data: {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        rating: getRandomInt(3, 5),
        comment: getRandomItem(reviewComments),
        reviewDate: getRandomDate(new Date(2024, 0, 1), new Date()),
      },
    });
  }

  // 17. Create Notifications
  console.log('🔔 Seeding Notifications...');
  
  // Create 5-15 notifications per user
  for (const user of users) {
    const numNotifications = getRandomInt(5, 15);
    for (let i = 0; i < numNotifications; i++) {
      await prisma.notification.create({
        data: {
          userId: user.id,
          content: getRandomItem(notificationContents),
          isRead: Math.random() > 0.6,
          sentAt: getRandomDate(new Date(2024, 0, 1), new Date()),
        },
      });
    }
  }

  // 18. Create Gamification Badges
  console.log('🏆 Seeding Badges & Certificates...');
  const badgeDefinitions = [];
  const badgeNames = [
    'Quick Learner', 'Dedicated Student', 'Quiz Master', 'Perfect Score',
    'Course Completer', 'Active Participant', 'Early Bird', 'Night Owl',
    'Consistent Learner', 'Social Butterfly', 'Helpful Peer', 'Rising Star'
  ];
  
  for (const name of badgeNames) {
    const badgeDef = await prisma.badgeDefinition.create({
      data: {
        name,
        description: `Awarded for ${name.toLowerCase()} achievement.`,
        icon: `https://example.com/badges/${name.replace(/\s+/g, '_').toLowerCase()}.png`,
      },
    });
    badgeDefinitions.push(badgeDef);
  }
  
  // Award badges to users (60% of users have badges)
  for (const user of users.filter(() => Math.random() > 0.4)) {
    const numBadges = getRandomInt(1, 5);
    const selectedBadges = getRandomItems(badgeDefinitions, numBadges);
    
    for (const badge of selectedBadges) {
      await prisma.userBadge.create({
        data: {
          userId: user.id,
          badgeDefinitionId: badge.id,
          obtainedAt: getRandomDate(new Date(2024, 0, 1), new Date()),
        },
      });
    }
  }

  // 19. Create Certificates
  console.log('🎓 Seeding Certificates...');
  
  // Create certificates for completed courses (30% of enrollments)
  for (const enrollment of allEnrollments.filter(() => Math.random() > 0.7)) {
    await prisma.certificate.create({
      data: {
        userId: enrollment.userId,
        courseId: enrollment.courseId,
        certificateNumber: `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
        issuedAt: getRandomDate(new Date(2024, 0, 1), new Date()),
      },
    });
  }

  // 20. Create Meetings
  console.log('📅 Seeding Meetings...');
  
  // Create meetings for published courses (40% have meetings)
  for (const course of publishedCourses.filter(() => Math.random() > 0.6)) {
    const numMeetings = getRandomInt(1, 4);
    for (let i = 0; i < numMeetings; i++) {
      await prisma.meeting.create({
        data: {
          courseId: course.id,
          title: `${course.title} - Live Session ${i + 1}`,
          meetingUrl: `https://zoom.us/j/${Math.random().toString(36).substr(2, 10)}`,
          meetingDate: getRandomDate(new Date(), new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)),
        },
      });
    }
  }

  // 21. Create Audit Logs
  console.log('📋 Seeding Audit Logs...');
  const actions = ['LOGIN', 'LOGOUT', 'COURSE_VIEW', 'ENROLLMENT', 'PAYMENT', 'QUIZ_ATTEMPT', 'SUBMISSION', 'REVIEW', 'CERTIFICATE_ISSUED', 'BADGE_EARNED'];
  const resources = ['USER', 'COURSE', 'LESSON', 'QUIZ', 'ASSIGNMENT', 'PAYMENT', 'CERTIFICATE', 'BADGE'];
  
  // Create audit logs for various user actions
  for (const user of users) {
    const numLogs = getRandomInt(10, 50);
    for (let i = 0; i < numLogs; i++) {
      await prisma.auditLog.create({
        data: {
          userId: user.id,
          action: getRandomItem(actions),
          resource: getRandomItem(resources),
          resourceId: Math.random() > 0.3 ? Math.random().toString(36).substr(2, 10) : null,
          details: Math.random() > 0.5 ? { timestamp: new Date().toISOString(), metadata: { source: 'web' } } : null,
          createdAt: getRandomDate(new Date(2024, 0, 1), new Date()),
        },
      });
    }
  }

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
