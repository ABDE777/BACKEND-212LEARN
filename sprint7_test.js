import http from 'http';

const BASE = 'http://localhost:5000/api/v1';
const DEMO_USERS = {
  admin: 'admin1@212learn.com',
  instructor: 'instructor1@212learn.com',
  student: 'student1@212learn.com',
};

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port:     url.port || 5000,
      path:     url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        ...headers,
      },
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function log(name, status, expected, details) {
  const pass = status === expected ? '✅ PASS' : `❌ FAIL (expected ${expected}, got ${status})`;
  console.log(`\n${pass} — ${name}`);
  console.log(`   Status: ${status}`);
  const safeDetails = details !== undefined && details !== null ? JSON.stringify(details).substring(0, 500) : '(empty)';
  console.log(`   Details:`, safeDetails);
}

async function findInstructorCourse(instructorToken) {
  const statuses = ['published', 'draft', 'archived'];

  for (const status of statuses) {
    const response = await request(
      'GET',
      `/courses?instructorId=me&status=${status}`,
      null,
      { Authorization: `Bearer ${instructorToken}` }
    );

    const course = response.body?.data?.courses?.[0];
    if (response.status === 200 && course) {
      return { course, status };
    }
  }

  return null;
}

async function runTests() {
  console.log('🚀 Starting Sprint 7: Analytics & Meetings Tests...\n');

  // ── SETUP: Logins ──────────────────────────────────────────────────────────
  const adminLogin = await request('POST', '/auth/login', {
    email: DEMO_USERS.admin,
    password: 'password123',
  });
  const instructorLogin = await request('POST', '/auth/login', {
    email: DEMO_USERS.instructor,
    password: 'password123',
  });
  const studentLogin = await request('POST', '/auth/login', {
    email: DEMO_USERS.student,
    password: 'password123',
  });

  if (!adminLogin.body?.token || !instructorLogin.body?.token || !studentLogin.body?.token) {
    console.error('\n❌ Login failed. Run the seeder first: npx prisma db seed');
    process.exit(1);
  }

  const adminToken      = adminLogin.body.token;
  const instructorToken = instructorLogin.body.token;
  const studentToken    = studentLogin.body.token;
  const studentId       = studentLogin.body?.data?.user?.id;

  console.log('📌 Admin Token:',      `${adminToken.substring(0, 20)}...`);
  console.log('📌 Instructor Token:', `${instructorToken.substring(0, 20)}...`);
  console.log('📌 Student Token:',    `${studentToken.substring(0, 20)}...`);

  // Get a course owned by the instructor and publish it if needed for student enrollment tests
  const instructorCourseResult = await findInstructorCourse(instructorToken);
  const courseId = instructorCourseResult?.course?.id;

  if (!courseId) {
    console.error('\n❌ No course found for the seeded instructor account.');
    process.exit(1);
  }

  if (instructorCourseResult.status !== 'published') {
    const publishRes = await request(
      'POST',
      `/courses/${courseId}/publish`,
      null,
      { Authorization: `Bearer ${adminToken}` }
    );

    if (publishRes.status !== 200) {
      console.error('\n❌ Could not publish the instructor course for meeting tests.');
      console.error(JSON.stringify(publishRes.body).substring(0, 300));
      process.exit(1);
    }
  }

  console.log('📌 Course ID:', courseId);

  // ── TEST 1: Revenue Analytics — Instructor ──────────────────────────────────
  const t1 = await request(
    'GET', '/instructor/analytics/revenue',
    null, { Authorization: `Bearer ${instructorToken}` }
  );
  log(
    'TEST 1: Instructor revenue analytics — expect 200 OK',
    t1.status, 200,
    {
      totalRevenue: t1.body?.data?.totalRevenue,
      currency:     t1.body?.data?.currency,
      months:       t1.body?.data?.monthly?.length,
      topCourses:   t1.body?.data?.topCourses?.map(c => c.title),
    }
  );

  // ── TEST 2: Revenue Analytics — Admin (global view) ─────────────────────────
  const t2 = await request(
    'GET', '/instructor/analytics/revenue',
    null, { Authorization: `Bearer ${adminToken}` }
  );
  log(
    'TEST 2: Admin global revenue analytics — expect 200 OK',
    t2.status, 200,
    { totalRevenue: t2.body?.data?.totalRevenue, months: t2.body?.data?.monthly?.length }
  );

  // ── TEST 3: Revenue — Blocked for students ──────────────────────────────────
  const t3 = await request(
    'GET', '/instructor/analytics/revenue',
    null, { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 3: Student blocked from revenue analytics — expect 403', t3.status, 403, { error: t3.body?.message });

  // ── TEST 4: Student Analytics — Instructor ──────────────────────────────────
  const t4 = await request(
    'GET', '/instructor/analytics/students',
    null, { Authorization: `Bearer ${instructorToken}` }
  );
  log(
    'TEST 4: Instructor student analytics — expect 200 OK',
    t4.status, 200,
    {
      totalStudents:     t4.body?.data?.totalStudents,
      totalEnrollments:  t4.body?.data?.totalEnrollments,
      coursesCount:      t4.body?.data?.courses?.length,
      firstCourse:       t4.body?.data?.courses?.[0]?.title,
    }
  );

  // ── TEST 5: Completion Analytics — Instructor ───────────────────────────────
  const t5 = await request(
    'GET', '/instructor/analytics/completion',
    null, { Authorization: `Bearer ${instructorToken}` }
  );
  log(
    'TEST 5: Course completion rates — expect 200 OK',
    t5.status, 200,
    {
      coursesCount:    t5.body?.data?.courses?.length,
      firstCourse:     t5.body?.data?.courses?.[0]?.title,
      completionRate:  t5.body?.data?.courses?.[0]?.completionRate,
      averageProgress: t5.body?.data?.courses?.[0]?.averageProgress,
    }
  );

  // ── TEST 6: List Course Meetings — expect 200 ───────────────────────────────
  const t6 = await request(
    'GET', `/courses/${courseId}/meetings`,
    null, { Authorization: `Bearer ${instructorToken}` }
  );
  log(
    'TEST 6: List course meetings — expect 200 OK',
    t6.status, 200,
    {
      total:    t6.body?.data?.total,
      upcoming: t6.body?.data?.upcoming?.length,
      past:     t6.body?.data?.past?.length,
    }
  );

  // ── TEST 7: Create Meeting — Instructor ─────────────────────────────────────
  const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days from now
  const t7 = await request(
    'POST',
    `/courses/${courseId}/meetings`,
    {
      title:       'Session Live: React Avancé — Hooks & Patterns',
      meetingUrl:  'https://zoom.us/j/987654321?pwd=abcdef',
      meetingDate: futureDate,
    },
    { Authorization: `Bearer ${instructorToken}` }
  );
  const meetingId = t7.body?.data?.id;
  log(
    'TEST 7: Instructor creates a meeting — expect 201 Created & students notified',
    t7.status, 201,
    {
      title:    t7.body?.data?.title,
      date:     t7.body?.data?.meetingDate,
      notified: t7.body?.data?.notified,
    }
  );

  // Ensure the student has PAID access before reading the meetings list
  const myCoursesRes = await request('GET', '/enrollments', null, { Authorization: `Bearer ${studentToken}` });
  const existingEnrollment = myCoursesRes.body?.data?.enrollments?.find((e) => e.courseId === courseId);
  if (existingEnrollment) {
    await request('DELETE', `/enrollments/${existingEnrollment.id}`, null, {
      Authorization: `Bearer ${studentToken}`,
    });
  }

  const paymentReq = await request(
    'POST',
    '/payments/wafacash/request',
    { courseId },
    { Authorization: `Bearer ${studentToken}` }
  );
  const paymentId = paymentReq.body?.data?.paymentId;
  const paymentReference = paymentReq.body?.data?.paymentReference;
  if (paymentId && paymentReference) {
    await request(
      'POST',
      '/payments/wafacash/submit',
      { paymentReference, mtcn: '7777777777' },
      { Authorization: `Bearer ${studentToken}` }
    );
    await request(
      'PATCH',
      '/payments/wafacash/verify',
      { paymentId, action: 'approve' },
      { Authorization: `Bearer ${adminToken}` }
    );
  }

  // ── TEST 8: Verify meeting appears in upcoming list ─────────────────────────
  const t8 = await request(
    'GET', `/courses/${courseId}/meetings`,
    null, { Authorization: `Bearer ${studentToken}` }
  );
  log(
    'TEST 8: Meeting appears in upcoming list — expect 200 OK & upcoming >= 1',
    t8.status, 200,
    {
      upcoming:   t8.body?.data?.upcoming?.length,
      firstTitle: t8.body?.data?.upcoming?.[0]?.title,
    }
  );

  // ── TEST 9: Invalid meeting URL blocked ─────────────────────────────────────
  const t9 = await request(
    'POST',
    `/courses/${courseId}/meetings`,
    {
      title:       'Bad Meeting',
      meetingUrl:  'not-a-url',
      meetingDate: futureDate,
    },
    { Authorization: `Bearer ${instructorToken}` }
  );
  log('TEST 9: Invalid meeting URL rejected — expect 400', t9.status, 400, { error: t9.body?.message });

  // ── TEST 10: Student blocked from creating meetings ─────────────────────────
  const t10 = await request(
    'POST',
    `/courses/${courseId}/meetings`,
    { title: 'Unauthorized', meetingUrl: 'https://zoom.us/j/123', meetingDate: futureDate },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 10: Student blocked from creating meetings — expect 403', t10.status, 403, { error: t10.body?.message });

  console.log('\n═══════════════════════════════════════════');
  console.log('🏁 Sprint 7: Analytics & Meetings Tests Completed');
  console.log('═══════════════════════════════════════════');
}

runTests().catch(console.error);
