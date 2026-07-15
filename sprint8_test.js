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
  const safeDetails = details !== undefined && details !== null ? JSON.stringify(details).substring(0, 500) : '(empty)';
  console.log(`   Details:`, safeDetails);
}

async function runTests() {
  console.log('🚀 Starting Sprint 8: Admin Moderation, KYC, Refunds & Auditing Tests...\n');

  // ── SETUP: Logins ──────────────────────────────────────────────────────────
  const adminLogin      = await request('POST', '/auth/login', { email: 'admin@212learn.com',      password: 'password123' });
  const instructorLogin = await request('POST', '/auth/login', { email: 'instructor@212learn.com', password: 'password123' });
  const studentLogin    = await request('POST', '/auth/login', { email: 'student@212learn.com',    password: 'password123' });

  if (!adminLogin.body?.token || !instructorLogin.body?.token || !studentLogin.body?.token) {
    console.error('\n❌ Login failed. Run the seeder first: npx prisma db seed');
    process.exit(1);
  }

  const adminToken      = adminLogin.body.token;
  const instructorToken = instructorLogin.body.token;
  const studentToken    = studentLogin.body.token;
  
  const studentId       = studentLogin.body?.data?.user?.id;
  const instructorId    = instructorLogin.body?.data?.user?.id;

  console.log('📌 Admin Token:',      `${adminToken.substring(0, 20)}...`);
  console.log('📌 Instructor Token:', `${instructorToken.substring(0, 20)}...`);
  console.log('📌 Student Token:',    `${studentToken.substring(0, 20)}...`);

  // ── TEST 1: GET /admin/users/pending-kyc (Blocked for Instructor/Student) ───
  const t1 = await request('GET', '/admin/users/pending-kyc', null, { Authorization: `Bearer ${instructorToken}` });
  log('TEST 1: Instructors blocked from pending KYC list — expect 403', t1.status, 403, { error: t1.body?.message });

  // ── TEST 2: GET /admin/users/pending-kyc (Admin gets pending KYC list) ──────
  const t2 = await request('GET', '/admin/users/pending-kyc', null, { Authorization: `Bearer ${adminToken}` });
  log('TEST 2: Admin lists pending KYC — expect 200 OK', t2.status, 200, {
    totalPending: t2.body?.data?.users?.length,
    users: t2.body?.data?.users?.map((u) => `${u.firstName} ${u.lastName} (${u.email})`),
  });

  // ── TEST 3: PATCH /admin/users/:userId/verify (Student tries to verify) ─────
  const t3 = await request(
    'PATCH',
    `/admin/users/${instructorId}/verify`,
    { isVerified: true, notes: 'Self verify attempt' },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 3: Student blocked from verifying instructors — expect 403', t3.status, 403, { error: t3.body?.message });

  // ── TEST 4: PATCH /admin/users/:userId/verify (Admin verifies instructor) ───
  const t4 = await request(
    'PATCH',
    `/admin/users/${instructorId}/verify`,
    { isVerified: true, notes: 'KYC documents approved' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 4: Admin verifies instructor — expect 200 OK', t4.status, 200, {
    id: t4.body?.data?.user?.id,
    isVerified: t4.body?.data?.user?.isVerified,
    message: t4.body?.data?.message,
  });

  // ── Find a published course ID for payment/refund cycle ────────────────────
  const coursesRes = await request('GET', '/courses');
  const courseId   = coursesRes.body?.data?.courses?.[0]?.id;
  console.log('📌 Course ID:', courseId);

  // Unenroll first if already enrolled so we can start fresh
  const myCoursesRes = await request('GET', '/enrollments', null, { Authorization: `Bearer ${studentToken}` });
  const existingEnrollment = myCoursesRes.body?.data?.enrollments?.find(e => e.courseId === courseId);
  if (existingEnrollment) {
    await request('DELETE', `/enrollments/${existingEnrollment.id}`, null, { Authorization: `Bearer ${studentToken}` });
    console.log('🧹 Cleaned up existing enrollment for test.');
  }

  // ── TEST 5: Student initializes payment request ─────────────────────────────
  const t5 = await request(
    'POST',
    '/payments/wafacash/request',
    { courseId },
    { Authorization: `Bearer ${studentToken}` }
  );
  const paymentId = t5.body?.data?.paymentId;
  const paymentRef = t5.body?.data?.paymentReference;
  log('TEST 5: Student requests Wafacash payment — expect 201 Created', t5.status, 201, {
    paymentId,
    paymentRef,
    amount: t5.body?.data?.amount,
  });

  // ── TEST 6: Student submits the transfer receipt ────────────────────────────
  const t6 = await request(
    'POST',
    '/payments/wafacash/submit',
    { paymentReference: paymentRef, mtcn: '1234567890' },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 6: Student submits transfer receipt — expect 200 OK', t6.status, 200, {
    status: t6.body?.data?.status,
    message: t6.body?.data?.message,
  });

  // ── TEST 7: Admin manual approval verification ──────────────────────────────
  const t7 = await request(
    'PATCH',
    '/payments/wafacash/verify',
    { paymentId, action: 'approve', notes: 'Validated manually by administrator' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 7: Admin verifies Wafacash payment — expect 200 OK', t7.status, 200, {
    status: t7.body?.data?.status,
    message: t7.body?.data?.message,
  });

  // ── TEST 8: Admin processes refund ──────────────────────────────────────────
  const t8 = await request(
    'PATCH',
    `/admin/payments/${paymentId}/refund`,
    { notes: 'Customer request' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 8: Admin refunds payment — expect 200 OK', t8.status, 200, {
    status: t8.body?.data?.payment?.status,
    message: t8.body?.message,
  });

  // ── TEST 9: Already refunded payment gets blocked ────────────────────────────
  const t9 = await request(
    'PATCH',
    `/admin/payments/${paymentId}/refund`,
    { notes: 'Duplicate refund attempt' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 9: Admin refund duplicate attempt gets rejected — expect 400', t9.status, 400, { error: t9.body?.message });

  // ── TEST 10: Verify Audit Logs contain entries ──────────────────────────────
  const t10 = await request('GET', '/admin/audit-logs', null, { Authorization: `Bearer ${adminToken}` });
  log('TEST 10: Admin lists audit logs — expect 200 OK', t10.status, 200, {
    totalLogs: t10.body?.data?.logs?.length,
    lastLogAction: t10.body?.data?.logs?.[0]?.action,
    lastLogUser: t10.body?.data?.logs?.[0]?.user?.email,
    secondLogAction: t10.body?.data?.logs?.[1]?.action,
  });

  console.log('\n═══════════════════════════════════════════');
  console.log('🏁 Sprint 8: Admin Moderation & Auditing Tests Completed');
  console.log('═══════════════════════════════════════════');
}

runTests().catch(console.error);
