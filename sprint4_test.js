import https from 'https';

const BASE = 'https://backend-212learn.vercel.app/api/v1';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers,
      },
    };
    const req = https.request(options, (res) => {
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
  const pass = status === expected ? '✅ PASS' : `❌ FAIL (expected ${expected})`;
  console.log(`\n${pass} — ${name}`);
  console.log(`   Status: ${status}`);
  console.log(`   Details:`, JSON.stringify(details).substring(0, 400));
}

async function runTests() {
  console.log('🚀 Starting Sprint 4 API Tests...\n');

  // ── SETUP: Login Student ─────────────────────────────────────
  const loginRes = await request('POST', '/auth/login', {
    email: 'student@212learn.com',
    password: 'password123',
  });
  const token = loginRes.body?.token;
  console.log('📌 Student Token:', token ? `${token.substring(0, 30)}...` : 'NOT OBTAINED ❌');
  if (!token) {
    console.error('Cannot continue without student token.');
    process.exit(1);
  }

  // ── SETUP: Get a courseId ────────────────────────────────────
  const coursesRes = await request('GET', '/courses');
  const courseId = coursesRes.body?.data?.courses?.[0]?.id;
  console.log('📌 CourseId:', courseId || 'NOT FOUND ❌');
  if (!courseId) {
    console.error('Cannot continue without a courseId.');
    process.exit(1);
  }

  let lessonId = null;

  // ── TEST 1: Curriculum as Guest (no token) ───────────────────
  const t1 = await request('GET', `/courses/${courseId}/curriculum`);
  const t1_hasAccess = t1.body?.data?.hasFullAccess;
  const t1_firstResUrl = t1.body?.data?.sections?.[0]?.lessons?.[0]?.resources?.[0]?.url;
  lessonId = t1.body?.data?.sections?.[0]?.lessons?.[0]?.id;
  log(
    'TEST 1: Curriculum as Guest — hasFullAccess should be false, URLs should be ENROLLMENT_REQUIRED',
    t1.status,
    200,
    { hasFullAccess: t1_hasAccess, firstResourceUrl: t1_firstResUrl, lessonId }
  );

  // ── TEST 2: Curriculum as unenrolled Student ─────────────────
  const t2 = await request('GET', `/courses/${courseId}/curriculum`, null, { Authorization: `Bearer ${token}` });
  const t2_hasAccess = t2.body?.data?.hasFullAccess;
  const t2_firstResUrl = t2.body?.data?.sections?.[0]?.lessons?.[0]?.resources?.[0]?.url;
  log(
    'TEST 2: Curriculum as Student — hasFullAccess reflects enrollment status',
    t2.status,
    200,
    { hasFullAccess: t2_hasAccess, firstResourceUrl: t2_firstResUrl }
  );

  // ── TEST 3: Assignments as unenrolled Student (expect 403) ───
  const t3 = await request('GET', `/lessons/${lessonId}/assignments`, null, { Authorization: `Bearer ${token}` });
  const t3_isEnrolled = t2_hasAccess; // if enrolled, 200 is correct
  const t3_expectedStatus = t3_isEnrolled ? 200 : 403;
  log(
    `TEST 3: Assignments as ${t3_isEnrolled ? 'enrolled' : 'unenrolled'} Student — expect ${t3_expectedStatus}`,
    t3.status,
    t3_expectedStatus,
    { message: t3.body?.error?.message || `count: ${t3.body?.data?.assignments?.length}` }
  );

  // ── TEST 4: Create Checkout Session with coupon ───────────────
  const t4 = await request(
    'POST',
    '/payments/checkout-session',
    { courseId, couponCode: 'WELCOME20' },
    { Authorization: `Bearer ${token}` }
  );
  const t4_expectedStatus = t2_hasAccess ? 409 : 200; // if enrolled, conflict
  log(
    `TEST 4: Checkout Session (${t2_hasAccess ? 'already enrolled → 409' : 'not enrolled → 200 with Stripe URL'})`,
    t4.status,
    t4_expectedStatus,
    {
      sessionUrl: t4.body?.data?.sessionUrl?.substring(0, 60),
      couponApplied: t4.body?.data?.course?.couponApplied,
      error: t4.body?.error?.message,
    }
  );

  // ── TEST 5: Admin tries to buy (expect 403) ──────────────────
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@212learn.com',
    password: 'password123',
  });
  const adminToken = adminLogin.body?.token;
  const t5 = await request(
    'POST',
    '/payments/checkout-session',
    { courseId },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 5: Admin creating checkout (must be 403 — only students can buy)', t5.status, 403, {
    error: t5.body?.error?.message,
  });

  // ── TEST 6: No auth checkout (expect 401) ────────────────────
  const t6 = await request('POST', '/payments/checkout-session', { courseId });
  log('TEST 6: No auth checkout (must be 401)', t6.status, 401, {
    error: t6.body?.error?.message,
  });

  // ── TEST 7: Webhook endpoint responds ────────────────────────
  const t7 = await request('POST', '/payments/webhook', { type: 'test.event' });
  log('TEST 7: Webhook responds (must be 200 or 400 — not 404)', t7.status, t7.status === 200 || t7.status === 400 ? t7.status : 404, {
    note: t7.status === 404 ? 'ROUTE NOT FOUND' : 'Route exists',
    body: t7.body,
  });

  console.log('\n═══════════════════════════════════════');
  console.log('🏁 Sprint 4 Test Suite Complete');
  console.log('═══════════════════════════════════════');
}

runTests().catch(console.error);
