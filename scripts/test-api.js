import { Blob } from 'buffer';
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = 'http://localhost:5000/api/v1';

// Generate unique emails to avoid conflicts
const ts = Date.now();
const emails = {
  admin: `admin_${ts}@212learn.com`,
  instructor: `instructor_${ts}@212learn.com`,
  student: `student_${ts}@212learn.com`,
};

const tokens = {
  admin: '',
  instructor: '',
  student: '',
};

let categoryId = '';
let courseId = '';
let sectionId = '';
let lessonId = '';
let assignmentId = '';
let submissionId = '';

// Helper for making requests
async function api(path, method = 'GET', body = null, token = null) {
  const headers = {};
  if (!(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const options = {
    method,
    headers,
  };

  if (body) {
    options.body = body instanceof FormData ? body : JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, options);
  let json = {};
  try {
    json = await res.json();
  } catch (err) {
    // No body or invalid json
  }

  if (!res.ok) {
    throw new Error(
      `API Error [${method} ${path}] status ${res.status}: ${
        json.error?.message || json.message || res.statusText
      }`
    );
  }
  if (json.token) {
    return { ...json.data, token: json.token };
  }
  return json.data || json;
}

// Main test execution runner
async function run() {
  console.log('🚀 Starting E2E Integration Tests for Sprints 1, 2, & 3...\n');

  // ───────────────────────────────────────────────────────────────────────────
  // SPRINT 1: Auth & Categories
  // ───────────────────────────────────────────────────────────────────────────
  console.log('--- SPRINT 1: Auth & Categories ---');

  // 1. Sign up users
  console.log('👉 Registering users...');
  await api('/auth/register', 'POST', {
    firstName: 'Test',
    lastName: 'Admin',
    email: emails.admin,
    password: 'Password123!',
    role: 'admin',
  });
  await api('/auth/register', 'POST', {
    firstName: 'Test',
    lastName: 'Instructor',
    email: emails.instructor,
    password: 'Password123!',
    role: 'instructor',
  });
  await api('/auth/register', 'POST', {
    firstName: 'Test',
    lastName: 'Student',
    email: emails.student,
    password: 'Password123!',
    role: 'student',
  });
  console.log('✅ Registration successful.');

  // 2. Login
  console.log('👉 Logging in...');
  const adminLogin = await api('/auth/login', 'POST', { email: emails.admin, password: 'Password123!' });
  tokens.admin = adminLogin.token;

  const instructorLogin = await api('/auth/login', 'POST', { email: emails.instructor, password: 'Password123!' });
  tokens.instructor = instructorLogin.token;

  const studentLogin = await api('/auth/login', 'POST', { email: emails.student, password: 'Password123!' });
  tokens.student = studentLogin.token;
  console.log('✅ Logins successful. JWT tokens acquired.');

  // 3. Test GET /auth/me
  console.log('👉 Verifying /auth/me...');
  const me = await api('/auth/me', 'GET', null, tokens.student);
  console.log(`✅ Current authenticated user email: ${me.user.email}`);

  // 4. Create Category (Admin only)
  console.log('👉 Creating category as Admin...');
  const cat = await api('/categories', 'POST', {
    name: `E2E Test Development ${ts}`,
    description: 'Category created by integration test script',
  }, tokens.admin);
  categoryId = cat.category.id;
  console.log(`✅ Category created successfully. ID: ${categoryId}`);

  // 5. Get Categories
  console.log('👉 Fetching category tree...');
  const cats = await api('/categories', 'GET');
  const found = cats.categories.find(c => c.id === categoryId);
  if (!found) throw new Error('Created category not found in tree');
  console.log('✅ Category tree verified.');

  // ───────────────────────────────────────────────────────────────────────────
  // SPRINT 2: Course Catalog & Instructor Space
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SPRINT 2: Course Catalog & Instructor Space ---');

  // 1. Create draft course as Instructor
  console.log('👉 Creating draft course as Instructor...');
  const course = await api('/courses', 'POST', {
    title: 'E2E Testing React App',
    description: 'Testing the entire application stack',
    categoryId,
    price: 99.99,
    level: 'intermediate',
    language: 'french',
    duration: 120,
  }, tokens.instructor);
  courseId = course.course.id;
  console.log(`✅ Draft course created. ID: ${courseId}`);

  // 2. Update course
  console.log('👉 Updating course details...');
  await api(`/courses/${courseId}`, 'PATCH', {
    title: 'E2E Testing React App (Updated)',
  }, tokens.instructor);
  console.log('✅ Course updated.');

  // 3. Verify course is NOT in public catalog yet (since status is draft)
  console.log('👉 Verifying draft is hidden from public list...');
  const initialCatalog = await api('/courses', 'GET');
  const initialFound = initialCatalog.courses.find(c => c.id === courseId);
  if (initialFound) {
    throw new Error('Draft course should not be visible in public catalog');
  }
  console.log('✅ Confirmed draft is hidden.');

  // 4. Publish course as Admin
  console.log('👉 Publishing course as Admin...');
  await api(`/courses/${courseId}/publish`, 'POST', null, tokens.admin);
  console.log('✅ Course published successfully.');

  // 5. Verify course IS in public catalog now
  console.log('👉 Verifying published course is visible...');
  const finalCatalog = await api('/courses', 'GET');
  const finalFound = finalCatalog.courses.find(c => c.id === courseId);
  if (!finalFound) {
    throw new Error('Published course should be visible in public catalog');
  }
  console.log('✅ Course is now visible in the catalog.');

  // ───────────────────────────────────────────────────────────────────────────
  // SPRINT 3: Curriculum, Resources, Assignments & Submissions
  // ───────────────────────────────────────────────────────────────────────────
  console.log('\n--- SPRINT 3: Curriculum & Content ---');

  // 1. Create section
  console.log('👉 Creating section...');
  const sec = await api(`/courses/${courseId}/sections`, 'POST', { title: 'First Section' }, tokens.instructor);
  sectionId = sec.section.id;
  console.log(`✅ Section created. ID: ${sectionId}`);

  // 2. Create lesson
  console.log('👉 Creating lesson...');
  const les = await api(`/sections/${sectionId}/lessons`, 'POST', { title: 'First Lesson' }, tokens.instructor);
  lessonId = les.lesson.id;
  console.log(`✅ Lesson created. ID: ${lessonId}`);

  // 3. Get Curriculum
  console.log('👉 Fetching curriculum...');
  const curr = await api(`/courses/${courseId}/curriculum`, 'GET');
  const secFound = curr.sections.find(s => s.id === sectionId);
  if (!secFound || !secFound.lessons.find(l => l.id === lessonId)) {
    throw new Error('Curriculum does not match created sections/lessons');
  }
  console.log('✅ Curriculum tree verified.');

  // 4. Add Resource: Link
  console.log('👉 Attaching link resource...');
  const resLink = await api(`/lessons/${lessonId}/resources`, 'POST', {
    type: 'link',
    url: 'https://react.dev',
  }, tokens.instructor);
  console.log(`✅ Link resource attached. ID: ${resLink.resource.id}`);

  // 5. Add Resource: File upload (if Cloudinary is configured)
  if (process.env.CLOUDINARY_CLOUD_NAME) {
    console.log('👉 Attaching file resource (Cloudinary upload)...');
    const formData = new FormData();
    const blob = new Blob(['Dummy PDF content'], { type: 'application/pdf' });
    formData.append('file', blob, 'syllabus.pdf');

    const resFile = await api(`/lessons/${lessonId}/resources`, 'POST', formData, tokens.instructor);
    console.log(`✅ File resource uploaded. URL: ${resFile.resource.url}`);
  } else {
    console.log('⚠️ Skipping Cloudinary upload test (Credentials missing in environment).');
  }

  // 6. Create Assignment
  console.log('👉 Creating assignment...');
  const assign = await api(`/lessons/${lessonId}/assignments`, 'POST', {
    title: 'Homework 1: App Setup',
    dueDate: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
  }, tokens.instructor);
  assignmentId = assign.assignment.id;
  console.log(`✅ Assignment created. ID: ${assignmentId}`);

  // 7. Student Submits Work
  console.log('👉 Submitting student homework...');
  const subFormData = new FormData();
  const subBlob = new Blob(['Student code contents'], { type: 'application/zip' });
  subFormData.append('file', subBlob, 'solution.zip');

  const sub = await api(`/assignments/${assignmentId}/submissions`, 'POST', subFormData, tokens.student);
  submissionId = sub.submission.id;
  console.log(`✅ Homework submitted. Submission ID: ${submissionId}`);

  // 8. Instructor reviews & grades submission
  console.log('👉 Grading submission as Instructor...');
  const graded = await api(`/submissions/${submissionId}/grade`, 'PATCH', {
    grade: 95.0,
    feedback: 'Excellent clean solution, tests pass!',
  }, tokens.instructor);
  console.log(`✅ Submission graded. Score: ${graded.submission.grade}%`);

  console.log('\n🌟 ALL TESTS PASSED SUCCESSFULLY! 🎉');
}

run().catch(err => {
  console.error('\n❌ TEST RUN FAILED:');
  console.error(err);
  process.exit(1);
});
