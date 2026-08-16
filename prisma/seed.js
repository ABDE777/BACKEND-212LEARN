/**
 * Comprehensive Seed Script for 212LEARN.
 * Seeds diverse instructors, categories, courses, lessons, quizzes, reviews, and enrollments
 * for testing performance, catalog filtering, 3D Coverflow carousels, and learning flows.
 *
 * All user accounts use password: password123
 */
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

const PASSWORD = 'password123';

async function clearAll() {
  console.log('🧹 Clearing existing database tables...');
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
  await prisma.courseUpdateRequest.deleteMany();
  await prisma.course.deleteMany();
  await prisma.category.deleteMany();
  await prisma.instructorProfile.deleteMany();
  await prisma.studentProfile.deleteMany();
  await prisma.user.deleteMany();
}

async function main() {
  console.log('🌱 Seeding rich production-ready test data...');
  await clearAll();

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ── 1. Admins / Platform Owners ──────────────────────────────────────────────
  console.log('👑 Creating Admin Accounts...');
  const admin = await prisma.user.create({
    data: {
      firstName: 'Ibrahim',
      lastName: 'Challal',
      email: 'ibrahim.challal@212learn.com',
      passwordHash,
      role: 'admin',
      isVerified: true,
      bio: 'Fondateur & Administrateur Principal de 212Learn',
      phone: '+212600000000',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&h=640&fit=crop&q=80',
    },
  });

  await prisma.user.create({
    data: {
      firstName: 'Abdel Monim',
      lastName: 'Mazguora',
      email: 'abdelmonim.mazguora@212learn.com',
      passwordHash,
      role: 'admin',
      isVerified: true,
      bio: 'Co-Fondateur & Directeur Technique de 212Learn',
      phone: '+212600000099',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&h=640&fit=crop&q=80',
    },
  });

  // ── 2. Instructors ─────────────────────────────────────────────────────────
  console.log('👨‍🏫 Creating Instructors...');

  const instructorSara = await prisma.user.create({
    data: {
      firstName: 'Sara',
      lastName: 'Instructor',
      email: 'instructor@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Lead web development instructor passionnée par React, Node.js et l\'architecture frontend moderne.',
      phone: '+212600000001',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=640&h=640&fit=crop&q=80',
      skills: ['React', 'Node.js', 'TypeScript', 'TailwindCSS'],
      socialLinks: { linkedin: 'https://linkedin.com/in/sarainstructor', github: 'https://github.com/sarainstructor' },
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructorSara.id,
      situation: 'employed',
      expertiseDomain: 'Web Development',
      specialization: 'React & Node.js',
      organization: '212Learn',
      department: 'Pédagogie',
      position: 'Lead Web Development Instructor',
      sector: 'Éducation & Tech',
      experienceYears: '3-5',
      teachingMode: 'online',
      teachingDomains: 'JavaScript, React, Node.js, Next.js',
    },
  });

  const instructorSofia = await prisma.user.create({
    data: {
      firstName: 'Dr. Sofia',
      lastName: 'Benali',
      email: 'sofia.benali@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Docteur en Intelligence Artificielle et chercheuse Senior Data Science.',
      phone: '+212611223344',
      avatar: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=640&h=640&fit=crop&q=80',
      skills: ['Python', 'Machine Learning', 'TensorFlow', 'Deep Learning', 'Data Science'],
      socialLinks: { linkedin: 'https://linkedin.com/in/sofiabenali', website: 'https://sofiabenali.ai' },
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructorSofia.id,
      situation: 'employed',
      expertiseDomain: 'Data & IA',
      specialization: 'Machine Learning & Deep Learning',
      organization: 'Capgemini Maroc',
      department: 'Data & AI Lab',
      position: 'Senior AI Researcher',
      sector: 'Conseil & Technologie',
      experienceYears: '>10',
      teachingMode: 'online',
      teachingDomains: 'Python, Data Science, Machine Learning, AI',
    },
  });

  const instructorKarim = await prisma.user.create({
    data: {
      firstName: 'Karim',
      lastName: 'Mansouri',
      email: 'karim.mansouri@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Architecte Cloud & DevSecOps avec 12 ans d\'expérience dans l\'accompagnement des entreprises.',
      phone: '+212622334455',
      avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=640&h=640&fit=crop&q=80',
      skills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
      socialLinks: { linkedin: 'https://linkedin.com/in/karimmansouri', github: 'https://github.com/karimmansouri' },
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructorKarim.id,
      situation: 'freelance',
      expertiseDomain: 'Cloud & DevOps',
      specialization: 'Cloud Architecture & Kubernetes',
      organization: 'CGI Maroc',
      position: 'Principal Cloud Architect',
      sector: 'Services Informatiques',
      experienceYears: '6-10',
      teachingMode: 'online',
      teachingDomains: 'AWS, Cloud, Docker, Kubernetes, DevOps',
    },
  });

  const instructorAmine = await prisma.user.create({
    data: {
      firstName: 'Amine',
      lastName: 'El Amrani',
      email: 'amine.elamrani@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Consultant en Cybersécurité et Pentesteur certifié (OSCP & CEH).',
      phone: '+212633445566',
      avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=640&h=640&fit=crop&q=80',
      skills: ['Ethical Hacking', 'Linux Security', 'Network Auditing', 'SIEM'],
      socialLinks: { linkedin: 'https://linkedin.com/in/amineelamrani' },
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructorAmine.id,
      situation: 'employed',
      expertiseDomain: 'Cybersécurité',
      specialization: 'Pentest & Sécurité Réseau',
      organization: 'DXC Technology',
      position: 'Senior Security Consultant',
      sector: 'Sécurité Informatique',
      experienceYears: '6-10',
      teachingMode: 'online',
      teachingDomains: 'Cybersecurity, Pentesting, Linux, Network Security',
    },
  });

  const instructorNadia = await prisma.user.create({
    data: {
      firstName: 'Nadia',
      lastName: 'Tazi',
      email: 'nadia.tazi@212learn.com',
      passwordHash,
      role: 'instructor',
      isVerified: true,
      bio: 'Lead UI/UX Designer spécialisée dans la création d\'interfaces immersives et de Design Systems.',
      phone: '+212644556677',
      avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=640&h=640&fit=crop&q=80',
      skills: ['Figma', 'UI/UX Design', 'Design Systems', 'User Research', 'Prototyping'],
      socialLinks: { linkedin: 'https://linkedin.com/in/nadiatazi', website: 'https://nadiatazi.design' },
    },
  });

  await prisma.instructorProfile.create({
    data: {
      userId: instructorNadia.id,
      situation: 'freelance',
      expertiseDomain: 'Design & UX/UI',
      specialization: 'Figma & Design Systems',
      organization: 'Studio UI',
      position: 'Head of Product Design',
      sector: 'Design & UX',
      experienceYears: '3-5',
      teachingMode: 'online',
      teachingDomains: 'Figma, UI Design, UX Research, Design System',
    },
  });

  // ── 3. Students ────────────────────────────────────────────────────────────
  console.log('🎓 Creating Students...');

  const studentYoussef = await prisma.user.create({
    data: {
      firstName: 'Youssef',
      lastName: 'Bennani',
      email: 'student1@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      phone: '+212600000002',
      avatar: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=640&h=640&fit=crop&q=80',
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: studentYoussef.id,
      situation: 'student',
      school: 'ENSIAS Rabat',
      fieldOfStudy: 'Génie Logiciel',
      educationLevel: 'Master',
      academicYearStart: new Date('2025-09-01'),
      academicYearEnd: new Date('2026-06-30'),
      isSelfDirected: false,
    },
  });

  const studentAmina = await prisma.user.create({
    data: {
      firstName: 'Amina',
      lastName: 'El Fassi',
      email: 'student2@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      phone: '+212600000003',
      avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=640&h=640&fit=crop&q=80',
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: studentAmina.id,
      situation: 'employee',
      companyName: 'OCP Group',
      department: 'Systèmes d\'Information',
      position: 'Analyste Développeur',
      sector: 'Industrie & Tech',
      experienceYears: '1-2',
      isSelfDirected: false,
    },
  });

  const studentMehdi = await prisma.user.create({
    data: {
      firstName: 'Mehdi',
      lastName: 'Alaoui',
      email: 'mehdi@212learn.com',
      passwordHash,
      role: 'student',
      isVerified: true,
      phone: '+212600000004',
      avatar: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=640&h=640&fit=crop&q=80',
    },
  });

  await prisma.studentProfile.create({
    data: {
      userId: studentMehdi.id,
      situation: 'self_directed',
      isSelfDirected: true,
    },
  });

  // ── 4. Categories ──────────────────────────────────────────────────────────
  console.log('📂 Creating Categories...');

  const catDev = await prisma.category.create({
    data: {
      name: 'Développement Web',
      description: 'HTML, CSS, JavaScript, React, Node.js, Next.js et architectures web modernes.',
      icon: 'Code',
    },
  });

  const catData = await prisma.category.create({
    data: {
      name: 'Data & IA',
      description: 'Python, Machine Learning, Deep Learning, SQL et analyse de données.',
      icon: 'Brain',
    },
  });

  const catCyber = await prisma.category.create({
    data: {
      name: 'Cybersécurité',
      description: 'Ethical Hacking, sécurité des réseaux, Linux SysAdmin et audit.',
      icon: 'Shield',
    },
  });

  const catCloud = await prisma.category.create({
    data: {
      name: 'Cloud & DevOps',
      description: 'Docker, Kubernetes, AWS, Terraform, CI/CD et déploiement continu.',
      icon: 'Cloud',
    },
  });

  const catDesign = await prisma.category.create({
    data: {
      name: 'Design UX/UI',
      description: 'Figma, Design Systems, UX Research et conception d\'interfaces web et mobile.',
      icon: 'Figma',
    },
  });

  // ── 5. Courses ─────────────────────────────────────────────────────────────
  console.log('📚 Creating Courses & Curriculum...');

  // Course 1: React & Next.js
  const courseReact = await prisma.course.create({
    data: {
      categoryId: catDev.id,
      title: 'React & Next.js 15 : Le Guide Complet',
      description: 'Maîtrisez React 19, les Server Components Next.js 15, Zustand, TailwindCSS et la création d\'applications web fullstack réactives.',
      price: 349.0,
      level: 'intermediate',
      language: 'french',
      duration: 720,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: courseReact.id, userId: instructorSara.id, role: 'lead_instructor' },
  });

  // Course 2: Python & Data Science
  const coursePython = await prisma.course.create({
    data: {
      categoryId: catData.id,
      title: 'Python pour la Data Science et le Machine Learning',
      description: 'Apprenez Python, Pandas, NumPy, Scikit-Learn et entraînez vos premiers modèles de Machine Learning de A à Z.',
      price: 399.0,
      level: 'beginner',
      language: 'french',
      duration: 900,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: coursePython.id, userId: instructorSofia.id, role: 'lead_instructor' },
  });

  // Course 3: Docker & Cloud DevOps
  const courseDocker = await prisma.course.create({
    data: {
      categoryId: catCloud.id,
      title: 'Docker, Kubernetes & DevOps CI/CD',
      description: 'Conteneurisez vos applications avec Docker, orchestrez avec Kubernetes et automatisez vos déploiements avec GitHub Actions & AWS.',
      price: 449.0,
      level: 'advanced',
      language: 'french',
      duration: 650,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1607799279861-4dd421887fb3?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: courseDocker.id, userId: instructorKarim.id, role: 'lead_instructor' },
  });

  // Course 4: Cybersécurité & Pentest
  const courseCyber = await prisma.course.create({
    data: {
      categoryId: catCyber.id,
      title: 'Cybersécurité : Ethical Hacking & Pentest',
      description: 'Découvrez les bases de l\'Ethical Hacking, l\'analyse de vulnérabilités, la sécurité Linux et la protection des infrastructures.',
      price: 499.0,
      level: 'intermediate',
      language: 'french',
      duration: 800,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: courseCyber.id, userId: instructorAmine.id, role: 'lead_instructor' },
  });

  // Course 5: Design UX/UI Figma
  const courseFigma = await prisma.course.create({
    data: {
      categoryId: catDesign.id,
      title: 'Design UI/UX Moderne avec Figma',
      description: 'Concevez des maquettes web et mobile professionnelles, des prototypes interactifs et votre premier Design System sous Figma.',
      price: 299.0,
      level: 'beginner',
      language: 'french',
      duration: 540,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: courseFigma.id, userId: instructorNadia.id, role: 'lead_instructor' },
  });

  // Course 6: JavaScript gratuit (Free Course)
  const courseJsFree = await prisma.course.create({
    data: {
      categoryId: catDev.id,
      title: 'Découverte Gratuite de JavaScript',
      description: 'Cours d\'initiation gratuit pour apprendre les bases absolues de JavaScript ES6+ et la manipulation du DOM.',
      price: 0,
      level: 'beginner',
      language: 'french',
      duration: 180,
      status: 'published',
      thumbnail: 'https://images.unsplash.com/photo-1579468118864-1b9ea3c0db4a?w=800&q=80',
    },
  });

  await prisma.courseInstructor.create({
    data: { courseId: courseJsFree.id, userId: instructorSara.id, role: 'lead_instructor' },
  });

  // ── 6. Sections, Lessons & Quizzes for React Course ────────────────────────
  const reactSec1 = await prisma.section.create({
    data: { courseId: courseReact.id, title: '1. Introduction & Fondations React', position: 1 },
  });

  const reactSec2 = await prisma.section.create({
    data: { courseId: courseReact.id, title: '2. Hooks & Gestion d\'État (useState, useEffect)', position: 2 },
  });

  const reactLes1 = await prisma.lesson.create({
    data: { sectionId: reactSec1.id, title: 'Pourquoi React en 2026 ?', position: 1 },
  });
  const reactLes2 = await prisma.lesson.create({
    data: { sectionId: reactSec1.id, title: 'Configuration de projet Vite + React', position: 2 },
  });
  const reactLes3 = await prisma.lesson.create({
    data: { sectionId: reactSec2.id, title: 'Comprendre useState avec un exemple concret', position: 1 },
  });

  await prisma.resource.createMany({
    data: [
      { lessonId: reactLes1.id, type: 'link', url: 'https://react.dev' },
      { lessonId: reactLes2.id, type: 'link', url: 'https://vitejs.dev' },
      { lessonId: reactLes3.id, type: 'link', url: 'https://react.dev/reference/react/useState' },
    ],
  });

  await prisma.assignment.create({
    data: {
      lessonId: reactLes3.id,
      title: 'Devoir Pratique : Créer un Compteur Interactif avec useState',
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  const quizReact = await prisma.quiz.create({
    data: {
      lessonId: reactLes3.id,
      title: 'Quiz de validation : Hooks React',
      validationStatus: 'approved',
    },
  });

  await prisma.question.createMany({
    data: [
      {
        quizId: quizReact.id,
        statement: 'Que renvoie le hook useState() dans React ?',
        options: ['Un objet avec la valeur', 'Un tableau [valeur, fonctionSetter]', 'Une promesse', 'Une référence DOM'],
        correctAnswer: 'Un tableau [valeur, fonctionSetter]',
      },
      {
        quizId: quizReact.id,
        statement: 'Comment modifier correctement la valeur d\'un état ?',
        options: ['En modifiant directement la variable', 'En appelant la fonction setter dédiée', 'En rechargeant la page', 'Via document.getElementById'],
        correctAnswer: 'En appelant la fonction setter dédiée',
      },
    ],
  });

  // ── 7. Enrollments, Payments & Reviews ─────────────────────────────────────
  console.log('💳 Creating Enrollments, Payments & Reviews...');

  // Student 1 (Youssef) -> Enrolled & Paid in React & Next.js Course
  const enrollmentYoussef = await prisma.enrollment.create({
    data: { userId: studentYoussef.id, courseId: courseReact.id },
  });

  await prisma.payment.create({
    data: {
      enrollmentId: enrollmentYoussef.id,
      amount: 349.0,
      currency: 'MAD',
      provider: 'wafacash',
      transactionReference: 'WFC-YOUSSEF-001',
      status: 'PAID',
      paidAt: new Date(),
      mtcn: '9876543210',
      verifiedBy: admin.id,
      verifiedAt: new Date(),
    },
  });

  await prisma.lessonProgress.create({
    data: {
      userId: studentYoussef.id,
      lessonId: reactLes1.id,
      completed: true,
      videoPosition: 0,
      timeSpent: 450,
      completedAt: new Date(),
    },
  });

  await prisma.review.create({
    data: {
      userId: studentYoussef.id,
      courseId: courseReact.id,
      rating: 5,
      comment: 'Formation exceptionnelle ! Sara explique les concepts complexes de manière ultra claire et concrète. Je recommande à 100%.',
    },
  });

  // Student 2 (Amina) -> Enrolled & Paid in Python Data Science
  const enrollmentAmina = await prisma.enrollment.create({
    data: { userId: studentAmina.id, courseId: coursePython.id },
  });

  await prisma.payment.create({
    data: {
      enrollmentId: enrollmentAmina.id,
      amount: 399.0,
      currency: 'MAD',
      provider: 'wafacash',
      transactionReference: 'WFC-AMINA-002',
      status: 'PAID',
      paidAt: new Date(),
      mtcn: '8765432109',
      verifiedBy: admin.id,
      verifiedAt: new Date(),
    },
  });

  await prisma.review.create({
    data: {
      userId: studentAmina.id,
      courseId: coursePython.id,
      rating: 5,
      comment: 'Excellente introduction au Machine Learning avec Dr. Sofia Benali. Très pédagogique avec de vrais cas pratiques !',
    },
  });

  // Student 3 (Mehdi) -> Enrolled in Free JavaScript Course & Figma Course Review
  await prisma.enrollment.create({
    data: { userId: studentMehdi.id, courseId: courseJsFree.id },
  });

  await prisma.review.create({
    data: {
      userId: studentMehdi.id,
      courseId: courseFigma.id,
      rating: 5,
      comment: 'Le cours de Figma par Nadia Tazi est une pépite. Les exercices sur les Design Systems sont directement applicables au travail.',
    },
  });

  // ── 8. Coupons, Badges, Meetings & Notifications ───────────────────────────
  await prisma.coupon.createMany({
    data: [
      {
        code: 'PROMO212',
        discount: 20,
        expirationDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
        maxUsage: 200,
        currentUsage: 5,
        isActive: true,
      },
      {
        code: 'WELCOME10',
        discount: 10,
        expirationDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
        maxUsage: 500,
        currentUsage: 12,
        isActive: true,
      },
    ],
  });

  await prisma.badgeDefinition.createMany({
    data: [
      { name: 'Pionnier React', description: 'Terminez votre première section du cours React', icon: '⚛️' },
      { name: 'Data Explorer', description: 'Réussissez un quiz de Data Science', icon: '📊' },
      { name: 'Maître du Code', description: 'Complétez 5 leçons interactives', icon: '🏆' },
    ],
  });

  await prisma.meeting.create({
    data: {
      courseId: courseReact.id,
      title: 'Session Live Cohorte #1 : Q&A React & Next.js 15',
      meetingUrl: 'https://meet.google.com/live-212learn-react',
      meetingDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      roomName: '212learn-cohorte-react-1',
      status: 'SCHEDULED',
      durationMinutes: 90,
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: studentYoussef.id,
        content: 'Félicitations ! Votre paiement pour "React & Next.js 15" a été validé.',
        isRead: false,
      },
      {
        userId: studentAmina.id,
        content: 'Rappel : La session live Q&A aura lieu dans 2 jours.',
        isRead: false,
      },
    ],
  });

  // ── 9. Groups & Group Chat Messages ───────────────────────────────────────
  const demoGroup = await prisma.group.create({
    data: {
      name: 'Cohorte Web & React Fullstack 2026',
      description: 'Groupe d\'échange et d\'accompagnement pour les étudiants de la cohorte React.',
      courseId: courseReact.id,
      formateurId: instructorSara.id,
      createdById: adminUser.id,
      students: {
        create: [
          { userId: studentYoussef.id },
          { userId: studentAmina.id },
        ],
      },
    },
  });

  await prisma.groupChatMessage.createMany({
    data: [
      {
        groupId: demoGroup.id,
        senderId: instructorSara.id,
        text: 'Bonjour à tous et bienvenue dans la cohorte Web & React 2026 ! N\'hésitez pas à poser vos questions ici.',
        status: 'approved',
      },
      {
        groupId: demoGroup.id,
        senderId: studentYoussef.id,
        text: 'Bonjour Madame Sara ! Merci pour ce cours, le chapitre sur Next.js 15 App Router est impressionnant.',
        status: 'approved',
      },
      {
        groupId: demoGroup.id,
        senderId: studentAmina.id,
        text: 'Bonjour professeur ! Quel outil recommandez-vous pour la gestion d\'état globale avec React ?',
        status: 'approved',
      },
    ],
  });

  // ── 10. Contact Messages ──────────────────────────────────────────────────
  await prisma.contactMessage.createMany({
    data: [
      {
        name: 'Othmane Berrada',
        email: 'othmane.berrada@gmail.com',
        phone: '+212 605-713171',
        subject: 'Information cours',
        message: 'Bonjour l\'équipe 212Learn, je souhaite savoir quand commence la prochaine session de Cybersécurité.',
        status: 'unread',
      },
      {
        name: 'Khadija Chraibi',
        email: 'khadija.chraibi@yahoo.fr',
        phone: '+212 631-883412',
        subject: 'Devenir formateur',
        message: 'Bonjour, experte avec 8 ans d\'expérience en Cloud AWS & DevOps, je souhaite proposer un cours sur votre plateforme.',
        status: 'unread',
      },
    ],
  });

  console.log('\n✅ SEEDING COMPLETE WITH RICH DATASET!\n');
  console.log('🔑 TEST ACCOUNTS (Password for all: password123)');
  console.log(' 👑 Admin:       admin@212learn.com');
  console.log(' 👨‍🏫 Instructors:');
  console.log('     - instructor@212learn.com      (Sara Instructor — React & Node.js)');
  console.log('     - sofia.benali@212learn.com    (Dr. Sofia Benali — Data & IA)');
  console.log('     - karim.mansouri@212learn.com  (Karim Mansouri — Cloud & DevOps)');
  console.log('     - amine.elamrani@212learn.com  (Amine El Amrani — Cybersécurité)');
  console.log('     - nadia.tazi@212learn.com      (Nadia Tazi — Design UX/UI)');
  console.log(' 🎓 Students:');
  console.log('     - student1@212learn.com        (Youssef Bennani — Paid React)');
  console.log('     - student2@212learn.com        (Amina El Fassi — Paid Python)');
  console.log('     - mehdi@212learn.com           (Mehdi Alaoui — Free JS)');
  console.log('\n🎟️ Active Coupons: PROMO212 (-20%), WELCOME10 (-10%)');
  console.log(`📚 Courses Seeded: ${courseReact.title}, ${coursePython.title}, ${courseDocker.title}, ${courseCyber.title}, ${courseFigma.title}, ${courseJsFree.title}\n`);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
