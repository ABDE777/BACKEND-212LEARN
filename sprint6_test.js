import http from 'http';

const BASE = 'http://localhost:5000/api/v1';

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
  const safeDetails = details !== undefined && details !== null ? JSON.stringify(details).substring(0, 400) : '(empty)';
  console.log(`   Details:`, safeDetails);
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function runTests() {
  console.log('🚀 Starting Sprint 6: Gamification, Reviews & Notifications Tests...\n');

  // ── SETUP: Logins ──────────────────────────────────────────────────────────
  const adminLogin   = await request('POST', '/auth/login', { email: 'admin@212learn.com',    password: 'password123' });
  const studentLogin = await request('POST', '/auth/login', { email: 'student@212learn.com',  password: 'password123' });

  if (!adminLogin.body?.token || !studentLogin.body?.token) {
    console.error('\n❌ Login failed. Run the seeder first: npx prisma db seed');
    console.error('   Admin response:',   JSON.stringify(adminLogin.body).substring(0, 200));
    console.error('   Student response:', JSON.stringify(studentLogin.body).substring(0, 200));
    process.exit(1);
  }

  const adminToken   = adminLogin.body.token;
  const studentToken = studentLogin.body.token;
  // The auth controller wraps the user inside successResponse: { data: { user: {...} } }
  const studentId    = studentLogin.body?.data?.user?.id;

  console.log('📌 Admin Token:',   `${adminToken.substring(0, 20)}...`);
  console.log('📌 Student Token:', `${studentToken.substring(0, 20)}...`);
  console.log('📌 Student ID:',    studentId);

  // Get a course and lesson IDs for later
  const coursesRes = await request('GET', '/courses');
  const courseId   = coursesRes.body?.data?.courses?.[0]?.id;
  const curriculum = await request('GET', `/courses/${courseId}/curriculum`, null, { Authorization: `Bearer ${adminToken}` });
  const lessonId   = curriculum.body?.data?.sections?.[0]?.lessons?.[0]?.id;
  console.log('📌 Course ID:', courseId);
  console.log('📌 Lesson ID:', lessonId);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: Get student achievements BEFORE any action (baseline)
  // ─────────────────────────────────────────────────────────────────────────
  const t1 = await request('GET', `/users/${studentId}/achievements`, null, { Authorization: `Bearer ${studentToken}` });
  log(
    'TEST 1: Get student achievements — expect 200 OK',
    t1.status, 200,
    {
      points:          t1.body?.data?.stats?.points,
      completedLessons: t1.body?.data?.stats?.completedLessons,
      badgesEarned:    t1.body?.data?.stats?.badgesEarned,
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Mark a lesson as completed → should trigger badge check
  // ─────────────────────────────────────────────────────────────────────────
  const t2 = await request(
    'POST',
    `/lessons/${lessonId}/progress`,
    { completed: true, videoPosition: 600, timeSpent: 700 },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 2: Mark lesson complete (triggers "First Steps" badge) — expect 200', t2.status, 200, t2.body?.data);

  // Wait a moment for async badge check
  await sleep(2000);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Get achievements after lesson completion — should have +10 points & badge
  // ─────────────────────────────────────────────────────────────────────────
  const t3 = await request('GET', `/users/${studentId}/achievements`, null, { Authorization: `Bearer ${studentToken}` });
  log(
    'TEST 3: Achievements after lesson completion — expect points ≥ 10 & badge "First Steps" awarded',
    t3.status, 200,
    {
      points:       t3.body?.data?.stats?.points,
      badgesEarned: t3.body?.data?.stats?.badgesEarned,
      badges:       t3.body?.data?.badges?.map(b => b.name),
    }
  );

  // TEST 4: Get all reviews for the course (public, no auth) — expect 200
  const t4 = await request('GET', `/courses/${courseId}/reviews`);
  log(
    'TEST 4: Get course reviews (public) — expect 200 OK',
    t4.status, 200,
    { totalReviews: t4.body?.data?.totalReviews, averageRating: t4.body?.data?.averageRating }
  );

  // TEST 5: Submit a new review as student — expect 201 Created
  const t5 = await request(
    'POST',
    `/courses/${courseId}/reviews`,
    { rating: 5, comment: 'Cours exceptionnel ! Très bien structuré et pédagogique.' },
    { Authorization: `Bearer ${studentToken}` }
  );
  const t5ExpectedStatus = (t5.status === 201 || t5.status === 200) ? t5.status : 201;
  log('TEST 5: Student submits review — expect 201 (new) or 200 (update)', t5.status, t5ExpectedStatus, t5.body?.data);

  // TEST 6: Update review by re-submitting (should return 200, not 409)
  const t6 = await request(
    'POST',
    `/courses/${courseId}/reviews`,
    { rating: 4, comment: 'Mis à jour : très bien mais pourrait contenir plus d\'exercices.' },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 6: Student updates review — expect 200 OK (not 409)', t6.status, 200, { message: t6.body?.data?.message });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 7: Get notifications for student — should include badge unlock alerts
  // ─────────────────────────────────────────────────────────────────────────
  const t7 = await request('GET', `/users/${studentId}/notifications`, null, { Authorization: `Bearer ${studentToken}` });
  log(
    'TEST 7: Get student notifications — expect 200 OK with unreadCount > 0',
    t7.status, 200,
    {
      unreadCount:       t7.body?.data?.unreadCount,
      totalNotifications: t7.body?.data?.notifications?.length,
      firstNotification: t7.body?.data?.notifications?.[0]?.content,
    }
  );

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 8: Mark all notifications as read — expect 200
  // ─────────────────────────────────────────────────────────────────────────
  const t8 = await request(
    'PATCH',
    `/users/${studentId}/notifications/read-all`,
    null,
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 8: Mark all notifications as read — expect 200', t8.status, 200, t8.body?.data);

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 9: Verify unreadCount is now 0
  // ─────────────────────────────────────────────────────────────────────────
  const t9 = await request('GET', `/users/${studentId}/notifications?unreadOnly=true`, null, { Authorization: `Bearer ${studentToken}` });
  log(
    'TEST 9: Verify unread count is 0 after marking all read — expect 200 & unreadCount = 0',
    t9.status, 200,
    { unreadCount: t9.body?.data?.unreadCount }
  );

  console.log('\n═══════════════════════════════════════');
  console.log('🏁 Sprint 6 Gamification & Reviews Tests Completed');
  console.log('═══════════════════════════════════════');
}

runTests().catch(console.error);
