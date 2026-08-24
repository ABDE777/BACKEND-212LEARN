/**
 * create-demo-data.js — Create instructor accounts and sample courses.
 *
 * This script creates demo instructor accounts and sample courses for testing.
 * Run this after creating admins to populate the platform with demo content.
 *
 * Usage:
 *   node prisma/create-demo-data.js
 *   npm run db:create-demo
 */
import prisma from '../src/config/prisma.js';
import bcrypt from 'bcryptjs';

const INSTRUCTORS = [
  {
    email: 'saad@212learn.com',
    firstName: 'Saad',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Algorithmique & Programmation',
    specialization: 'Algorithmique, POO',
    organization: '212Learn',
    department: 'Développement',
    position: 'Instructor',
    sector: 'Technology',
    experienceYears: '5',
    teachingMode: 'online',
    teachingDomains: 'Algorithmique, Programmation Orientée Objet',
  },
  {
    email: 'hanane@212learn.com',
    firstName: 'Hanane',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Développement Frontend',
    specialization: 'HTML, CSS, JavaScript',
    organization: '212Learn',
    department: 'Développement',
    position: 'Instructor',
    sector: 'Technology',
    experienceYears: '6',
    teachingMode: 'online',
    teachingDomains: 'HTML, CSS, JavaScript, Sites Web Statiques',
  },
  {
    email: 'ibrahim@212learn.com',
    firstName: 'Ibrahim',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Bases de Données & Backend',
    specialization: 'SQL, PHP, Gestion de Données',
    organization: '212Learn',
    department: 'Développement',
    position: 'Senior Instructor',
    sector: 'Technology',
    experienceYears: '8',
    teachingMode: 'hybrid',
    teachingDomains: 'SQL, Bases de Données, PHP, Gestion de Données',
  },
  {
    email: 'ouissal@212learn.com',
    firstName: 'Ouissal',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Développement Web Dynamique & Backend',
    specialization: 'PHP, Laravel, Backend',
    organization: '212Learn',
    department: 'Développement',
    position: 'Instructor',
    sector: 'Technology',
    experienceYears: '5',
    teachingMode: 'online',
    teachingDomains: 'PHP, Sites Web Dynamiques, Laravel, Backend',
  },
  {
    email: 'younes@212learn.com',
    firstName: 'Younes',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Projets Web & Cloud',
    specialization: 'Projets Web, Cloud Native',
    organization: '212Learn',
    department: 'Développement',
    position: 'Instructor',
    sector: 'Technology',
    experienceYears: '7',
    teachingMode: 'hybrid',
    teachingDomains: 'Projets Web, Cloud Native, Architecture',
  },
  {
    email: 'abd.el.monim@212learn.com',
    firstName: 'Abd El Monim',
    lastName: 'Instructor',
    password: 'password123',
    expertiseDomain: 'Agile & Frontend Avancé',
    specialization: 'Agile, React, Frontend',
    organization: '212Learn',
    department: 'Développement',
    position: 'Lead Instructor',
    sector: 'Technology',
    experienceYears: '10',
    teachingMode: 'hybrid',
    teachingDomains: 'Agile, React, Frontend Avancé',
  },
];

const STUDENTS = [
  {
    email: 'saadetudiant@212learn.com',
    firstName: 'Saad',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Licence',
  },
  {
    email: 'hananeetudiant@212learn.com',
    firstName: 'Hanane',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Licence',
  },
  {
    email: 'ibrahimetudiant@212learn.com',
    firstName: 'Ibrahim',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Master',
  },
  {
    email: 'ouissaletudiant@212learn.com',
    firstName: 'Ouissal',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Licence',
  },
  {
    email: 'younesetudiant@212learn.com',
    firstName: 'Younes',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Master',
  },
  {
    email: 'abd.el.monimetudiant@212learn.com',
    firstName: 'Abd El Monim',
    lastName: 'Étudiant',
    password: 'password123',
    situation: 'student',
    school: 'Université 212Learn',
    fieldOfStudy: 'Informatique',
    educationLevel: 'Master',
  },
];

const COURSES = [
  // Année 1
  {
    title: 'Acquérir les bases de l\'algorithmique',
    description: 'Apprenez les fondamentaux de l\'algorithmique et de la logique de programmation.',
    price: 149,
    level: 'beginner',
    language: 'french',
    duration: 20,
    status: 'draft',
    instructorEmail: 'saad@212learn.com',
    categoryName: 'Algorithmique',
    sections: [
      {
        title: 'Introduction à l\'algorithmique',
        lessons: [
          { title: 'Qu\'est-ce qu\'un algorithme' },
          { title: 'Structures de base' },
          { title: 'Variables et types' },
        ],
      },
      {
        title: 'Structures de contrôle',
        lessons: [
          { title: 'Conditions' },
          { title: 'Boucles' },
          { title: 'Exercices pratiques' },
        ],
      },
    ],
  },
  {
    title: 'Programmer en Orienté Objet',
    description: 'Maîtrisez les concepts de la programmation orientée objet (POO).',
    price: 149,
    level: 'intermediate',
    language: 'french',
    duration: 25,
    status: 'draft',
    instructorEmail: 'saad@212learn.com',
    categoryName: 'Programmation',
    sections: [
      {
        title: 'Concepts POO',
        lessons: [
          { title: 'Classes et objets' },
          { title: 'Héritage' },
          { title: 'Polymorphisme' },
        ],
      },
      {
        title: 'Pratique POO',
        lessons: [
          { title: 'Design patterns' },
          { title: 'Projet pratique' },
        ],
      },
    ],
  },
  {
    title: 'Développer des sites web statiques',
    description: 'Apprenez HTML et CSS pour créer des sites web statiques professionnels.',
    price: 249,
    level: 'beginner',
    language: 'french',
    duration: 30,
    status: 'draft',
    instructorEmail: 'hanane@212learn.com',
    categoryName: 'Développement Web',
    sections: [
      {
        title: 'HTML',
        lessons: [
          { title: 'Structure HTML' },
          { title: 'Formulaires' },
          { title: 'Sémantique HTML5' },
        ],
      },
      {
        title: 'CSS',
        lessons: [
          { title: 'Sélecteurs et propriétés' },
          { title: 'Flexbox et Grid' },
          { title: 'Responsive design' },
        ],
      },
    ],
  },
  {
    title: 'Programmer en JavaScript',
    description: 'Maîtrisez JavaScript pour créer des sites web interactifs et dynamiques.',
    price: 249,
    level: 'intermediate',
    language: 'french',
    duration: 35,
    status: 'draft',
    instructorEmail: 'hanane@212learn.com',
    categoryName: 'Développement Web',
    sections: [
      {
        title: 'Fondamentaux JavaScript',
        lessons: [
          { title: 'Variables et types' },
          { title: 'Fonctions' },
          { title: 'DOM manipulation' },
        ],
      },
      {
        title: 'JavaScript Avancé',
        lessons: [
          { title: 'ES6+' },
          { title: 'Async/Await' },
          { title: 'API Fetch' },
        ],
      },
    ],
  },
  {
    title: 'Manipuler des bases de données',
    description: 'Apprenez à concevoir et manipuler des bases de données relationnelles avec SQL.',
    price: 199,
    level: 'intermediate',
    language: 'french',
    duration: 25,
    status: 'draft',
    instructorEmail: 'ibrahim@212learn.com',
    categoryName: 'Bases de Données',
    sections: [
      {
        title: 'Introduction aux BDD',
        lessons: [
          { title: 'Modélisation' },
          { title: 'SQL de base' },
          { title: 'Requêtes avancées' },
        ],
      },
      {
        title: 'Pratique SQL',
        lessons: [
          { title: 'Jointures' },
          { title: 'Optimisation' },
        ],
      },
    ],
  },
  {
    title: 'Développer des sites web dynamiques',
    description: 'Créez des sites web dynamiques avec PHP et intégrez des bases de données.',
    price: 249,
    level: 'intermediate',
    language: 'french',
    duration: 40,
    status: 'draft',
    instructorEmail: 'ouissal@212learn.com',
    categoryName: 'Développement Web',
    sections: [
      {
        title: 'PHP Fundamentals',
        lessons: [
          { title: 'Syntaxe PHP' },
          { title: 'Formulaires' },
          { title: 'Sessions' },
        ],
      },
      {
        title: 'PHP & MySQL',
        lessons: [
          { title: 'Connexion BDD' },
          { title: 'CRUD operations' },
          { title: 'Sécurité' },
        ],
      },
    ],
  },
  // Année 2
  {
    title: 'Préparation d\'un projet web',
    description: 'Apprenez à planifier et préparer des projets web professionnels.',
    price: 149,
    level: 'intermediate',
    language: 'french',
    duration: 15,
    status: 'draft',
    instructorEmail: 'younes@212learn.com',
    categoryName: 'Projets Web',
    sections: [
      {
        title: 'Planification',
        lessons: [
          { title: 'Cahier des charges' },
          { title: 'Maquettage' },
          { title: 'Architecture' },
        ],
      },
    ],
  },
  {
    title: 'Approche agile',
    description: 'Maîtrisez les méthodologies agiles pour la gestion de projet.',
    price: 249,
    level: 'intermediate',
    language: 'french',
    duration: 20,
    status: 'draft',
    instructorEmail: 'abd.el.monim@212learn.com',
    categoryName: 'Gestion de Projet',
    sections: [
      {
        title: 'Méthodes Agiles',
        lessons: [
          { title: 'Scrum' },
          { title: 'Kanban' },
          { title: 'Sprints' },
        ],
      },
      {
        title: 'Pratique Agile',
        lessons: [
          { title: 'Daily standup' },
          { title: 'Retrospectives' },
        ],
      },
    ],
  },
  {
    title: 'Gestion des données',
    description: 'Approfondissez vos connaissances en gestion et manipulation de données.',
    price: 199,
    level: 'advanced',
    language: 'french',
    duration: 25,
    status: 'draft',
    instructorEmail: 'ibrahim@212learn.com',
    categoryName: 'Bases de Données',
    sections: [
      {
        title: 'Données Avancées',
        lessons: [
          { title: 'Transactions' },
          { title: 'Procédures stockées' },
          { title: 'Triggers' },
        ],
      },
    ],
  },
  {
    title: 'Développement front-end',
    description: 'Maîtrisez les frameworks modernes de développement front-end.',
    price: 299,
    level: 'advanced',
    language: 'french',
    duration: 45,
    status: 'draft',
    instructorEmail: 'abd.el.monim@212learn.com',
    categoryName: 'Développement Web',
    sections: [
      {
        title: 'React',
        lessons: [
          { title: 'Components' },
          { title: 'State management' },
          { title: 'Hooks' },
        ],
      },
      {
        title: 'React Avancé',
        lessons: [
          { title: 'Redux' },
          { title: 'Routing' },
          { title: 'Testing' },
        ],
      },
    ],
  },
  {
    title: 'Développement back-end',
    description: 'Créez des APIs robustes avec Laravel et des frameworks modernes.',
    price: 299,
    level: 'advanced',
    language: 'french',
    duration: 45,
    status: 'draft',
    instructorEmail: 'ouissal@212learn.com',
    categoryName: 'Développement Web',
    sections: [
      {
        title: 'Laravel',
        lessons: [
          { title: 'Architecture MVC' },
          { title: 'Eloquent ORM' },
          { title: 'Authentification' },
        ],
      },
      {
        title: 'APIs REST',
        lessons: [
          { title: 'REST principles' },
          { title: 'API Laravel' },
          { title: 'Documentation' },
        ],
      },
    ],
  },
  {
    title: 'Création d\'une application Cloud native',
    description: 'Apprenez à créer des applications cloud natives avec Docker et Kubernetes.',
    price: 249,
    level: 'advanced',
    language: 'french',
    duration: 30,
    status: 'draft',
    instructorEmail: 'younes@212learn.com',
    categoryName: 'Cloud',
    sections: [
      {
        title: 'Cloud Native',
        lessons: [
          { title: 'Docker' },
          { title: 'Kubernetes' },
          { title: 'CI/CD' },
        ],
      },
    ],
  },
  {
    title: 'Projet de synthèse',
    description: 'Projet final intégrant toutes les compétences acquises.',
    price: 99,
    level: 'advanced',
    language: 'french',
    duration: 40,
    status: 'draft',
    instructorEmail: 'younes@212learn.com',
    categoryName: 'Projets Web',
    sections: [
      {
        title: 'Projet Final',
        lessons: [
          { title: 'Lancement' },
          { title: 'Développement' },
          { title: 'Présentation' },
        ],
      },
    ],
  },
  // Packs
  {
    title: 'Pack 1A Frontend (HTML, CSS, JS)',
    description: 'Pack complet pour maîtriser le développement frontend: HTML, CSS et JavaScript.',
    price: 349,
    level: 'beginner',
    language: 'french',
    duration: 60,
    status: 'draft',
    instructorEmail: 'hanane@212learn.com',
    categoryName: 'Packs',
    sections: [
      {
        title: 'HTML & CSS',
        lessons: [
          { title: 'HTML avancé' },
          { title: 'CSS avancé' },
        ],
      },
      {
        title: 'JavaScript',
        lessons: [
          { title: 'JS complet' },
          { title: 'Projets frontend' },
        ],
      },
    ],
  },
  {
    title: 'Pack 1A Backend (SQL, PHP)',
    description: 'Pack complet pour maîtriser le développement backend: SQL et PHP.',
    price: 299,
    level: 'intermediate',
    language: 'french',
    duration: 50,
    status: 'draft',
    instructorEmail: 'ibrahim@212learn.com',
    categoryName: 'Packs',
    sections: [
      {
        title: 'SQL',
        lessons: [
          { title: 'SQL avancé' },
          { title: 'Optimisation' },
        ],
      },
      {
        title: 'PHP',
        lessons: [
          { title: 'PHP avancé' },
          { title: 'Projets backend' },
        ],
      },
    ],
  },
  {
    title: 'Pack 1A Régional (HTML, CSS, JS, PHP)',
    description: 'Pack complet régional: Frontend et Backend ensemble. Prix spécial pour les 5 premiers inscrits.',
    price: 499,
    level: 'intermediate',
    language: 'french',
    duration: 100,
    status: 'draft',
    instructorEmail: 'abd.el.monim@212learn.com',
    categoryName: 'Packs',
    sections: [
      {
        title: 'Frontend Complet',
        lessons: [
          { title: 'HTML/CSS/JS complet' },
        ],
      },
      {
        title: 'Backend Complet',
        lessons: [
          { title: 'PHP/SQL complet' },
        ],
      },
      {
        title: 'Projet Intégré',
        lessons: [
          { title: 'Projet fullstack' },
        ],
      },
    ],
  },
  {
    title: 'Pack 2A Régional (React, Laravel, Agile)',
    description: 'Pack avancé régional: React, Laravel et méthodologies Agile. Prix spécial pour les 5 premiers inscrits.',
    price: 599,
    level: 'advanced',
    language: 'french',
    duration: 120,
    status: 'draft',
    instructorEmail: 'abd.el.monim@212learn.com',
    categoryName: 'Packs',
    sections: [
      {
        title: 'React Avancé',
        lessons: [
          { title: 'React ecosystem' },
        ],
      },
      {
        title: 'Laravel Pro',
        lessons: [
          { title: 'Laravel avancé' },
        ],
      },
      {
        title: 'Agile & DevOps',
        lessons: [
          { title: 'Méthodologies agile' },
          { title: 'DevOps basics' },
        ],
      },
      {
        title: 'Projet Enterprise',
        lessons: [
          { title: 'Projet final' },
        ],
      },
    ],
  },
];

async function main() {
  console.log('\n📚 212Learn — Création des données de démonstration\n');

  // Create instructors
  console.log('👨‍🏫 Création des instructeurs...\n');
  const instructorMap = new Map();

  for (const instructor of INSTRUCTORS) {
    const existing = await prisma.user.findUnique({
      where: { email: instructor.email },
    });

    if (existing) {
      console.log(`⚠️  Instructeur déjà existant : ${instructor.email}`);
      
      // Check if profile exists, create if missing
      const existingProfile = await prisma.instructorProfile.findUnique({
        where: { userId: existing.id },
      });
      
      if (!existingProfile) {
        console.log(`📝 Création du profil manquant pour : ${instructor.email}`);
        await prisma.instructorProfile.create({
          data: {
            userId: existing.id,
            expertiseDomain: instructor.expertiseDomain,
            specialization: instructor.specialization,
            organization: instructor.organization,
            department: instructor.department,
            position: instructor.position,
            sector: instructor.sector,
            experienceYears: String(instructor.experienceYears),
            teachingMode: instructor.teachingMode,
            teachingDomains: instructor.teachingDomains,
          },
        });
        console.log(`✅ Profil créé pour : ${instructor.email}`);
      }
      
      instructorMap.set(instructor.email, existing.id);
      continue;
    }

    const passwordHash = await bcrypt.hash(instructor.password, 10);

    const user = await prisma.user.create({
      data: {
        email: instructor.email,
        firstName: instructor.firstName,
        lastName: instructor.lastName,
        passwordHash,
        role: 'instructor',
        isVerified: true,
      },
    });

    // Create instructor profile
    await prisma.instructorProfile.create({
      data: {
        userId: user.id,
        expertiseDomain: instructor.expertiseDomain,
        specialization: instructor.specialization,
        organization: instructor.organization,
        department: instructor.department,
        position: instructor.position,
        sector: instructor.sector,
        experienceYears: String(instructor.experienceYears),
        teachingMode: instructor.teachingMode,
        teachingDomains: instructor.teachingDomains,
      },
    });

    console.log(`✅ Instructeur créé : ${user.email}`);
    instructorMap.set(instructor.email, user.id);
  }

  // Create students
  console.log('\n👨‍🎓 Création des étudiants...\n');
  const studentMap = new Map();

  for (const student of STUDENTS) {
    const existing = await prisma.user.findUnique({
      where: { email: student.email },
    });

    if (existing) {
      console.log(`⚠️  Étudiant déjà existant : ${student.email}`);
      
      // Check if profile exists, create if missing
      const existingProfile = await prisma.studentProfile.findUnique({
        where: { userId: existing.id },
      });
      
      if (!existingProfile) {
        console.log(`📝 Création du profil manquant pour : ${student.email}`);
        await prisma.studentProfile.create({
          data: {
            userId: existing.id,
            situation: student.situation,
            school: student.school,
            fieldOfStudy: student.fieldOfStudy,
            educationLevel: student.educationLevel,
          },
        });
        console.log(`✅ Profil créé pour : ${student.email}`);
      }
      
      studentMap.set(student.email, existing.id);
      continue;
    }

    const passwordHash = await bcrypt.hash(student.password, 10);

    const user = await prisma.user.create({
      data: {
        email: student.email,
        firstName: student.firstName,
        lastName: student.lastName,
        passwordHash,
        role: 'student',
        isVerified: true,
      },
    });

    // Create student profile
    await prisma.studentProfile.create({
      data: {
        userId: user.id,
        situation: student.situation,
        school: student.school,
        fieldOfStudy: student.fieldOfStudy,
        educationLevel: student.educationLevel,
      },
    });

    console.log(`✅ Étudiant créé : ${user.email}`);
    studentMap.set(student.email, user.id);
  }

  // Create courses
  console.log('\n📖 Création des cours...\n');
  
  for (const course of COURSES) {
    const instructorId = instructorMap.get(course.instructorEmail);
    if (!instructorId) {
      console.log(`⚠️  Instructeur non trouvé pour le cours : ${course.title}`);
      continue;
    }

    // Check if course already exists
    const existingCourse = await prisma.course.findFirst({
      where: { title: course.title },
    });

    if (existingCourse) {
      console.log(`⚠️  Cours déjà existant : ${course.title}`);
      continue;
    }

    // Find or create category
    let category = await prisma.category.findFirst({
      where: { name: course.categoryName },
    });

    if (!category) {
      category = await prisma.category.create({
        data: {
          name: course.categoryName,
          description: `Cours de ${course.categoryName}`,
        },
      });
    }

    // Create course
    const createdCourse = await prisma.course.create({
      data: {
        title: course.title,
        description: course.description,
        price: course.price,
        level: course.level,
        language: course.language,
        duration: course.duration,
        status: course.status,
        categoryId: category.id,
        thumbnail: 'https://via.placeholder.com/800x400/4F46E5/FFFFFF?text=' + encodeURIComponent(course.title),
      },
    });

    // Assign instructor to course
    await prisma.courseInstructor.create({
      data: {
        courseId: createdCourse.id,
        userId: instructorId,
        role: 'lead_instructor',
      },
    });

    // Create sections and lessons
    for (const section of course.sections) {
      const createdSection = await prisma.section.create({
        data: {
          courseId: createdCourse.id,
          title: section.title,
          position: course.sections.indexOf(section) + 1,
        },
      });

      for (const lesson of section.lessons) {
        await prisma.lesson.create({
          data: {
            sectionId: createdSection.id,
            title: lesson.title,
            position: section.lessons.indexOf(lesson) + 1,
          },
        });
      }
    }

    console.log(`✅ Cours créé : ${course.title}`);
  }

  console.log('\n✅ Terminé. Les données de démonstration sont prêtes.\n');
}

main()
  .catch((err) => {
    console.error('\n❌ Échec de la création des données de démonstration :', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
