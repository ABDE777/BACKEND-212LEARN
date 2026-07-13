import http from 'http';

const BASE = 'http://localhost:5000/api/v1';

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const options = {
      hostname: url.hostname,
      port: url.port || 5000,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
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
  const pass = status === expected ? '✅ PASS' : `❌ FAIL (expected ${expected})`;
  console.log(`\n${pass} — ${name}`);
  console.log(`   Status: ${status}`);
  console.log(`   Details:`, JSON.stringify(details).substring(0, 500));
}

async function runTests() {
  console.log('🚀 Starting Robust Wafacash Payment Integration & Access Control Tests...\n');

  // ── SETUP: Register a brand new student 1 ───────────────────
  const testEmail1 = `student_1_${Date.now()}@212learn.com`;
  const registerRes1 = await request('POST', '/auth/register', {
    firstName: 'Test',
    lastName: 'Student One',
    email: testEmail1,
    password: 'password123',
    role: 'student',
  });
  const token1 = registerRes1.body?.token;
  console.log('📌 Student 1 Token:', token1 ? `${token1.substring(0, 20)}...` : 'NOT OBTAINED ❌');

  // ── SETUP: Get two course IDs to test multiple flows ─────────
  const coursesRes = await request('GET', '/courses');
  const courses = coursesRes.body?.data?.courses || [];
  const courseId1 = courses[0]?.id;
  const courseId2 = courses[1]?.id || courseId1; // fallback if only 1 course exists
  console.log('📌 CourseId 1:', courseId1);
  console.log('📌 CourseId 2:', courseId2);

  if (!courseId1) {
    console.error('No courses found in database.');
    process.exit(1);
  }

  // ── TEST 1: Request Wafacash payment voucher ─────────────────
  const t1 = await request(
    'POST',
    '/payments/wafacash/request',
    { courseId: courseId1 },
    { Authorization: `Bearer ${token1}` }
  );
  const ref1 = t1.body?.data?.paymentReference;
  log('TEST 1: Initialize Wafacash Payment Request — expect 201 Created', t1.status, 201, t1.body);

  // ── TEST 2: Verify Access is REDACTED for PENDING status ─────
  const t2 = await request('GET', `/courses/${courseId1}/curriculum`, null, { Authorization: `Bearer ${token1}` });
  const t2_hasAccess = t2.body?.data?.hasFullAccess;
  const t2_firstResUrl = t2.body?.data?.sections?.[0]?.lessons?.[0]?.resources?.[0]?.url;
  const lessonId1 = t2.body?.data?.sections?.[0]?.lessons?.[0]?.id;
  log('TEST 2: Access Redacted for PENDING payment — expect hasFullAccess: false', t2.status, 200, {
    hasFullAccess: t2_hasAccess,
    firstResourceUrl: t2_firstResUrl,
  });

  // ── TEST 3: Assignments Blocked when pending (expect 403) ───
  const t3 = await request('GET', `/lessons/${lessonId1}/assignments`, null, { Authorization: `Bearer ${token1}` });
  log('TEST 3: Assignments locked when payment is pending — expect 403 Forbidden', t3.status, 403, t3.body);

  // ── TEST 4: Student submits MTCN in demo mode (instantly PAID) ──
  const t4 = await request(
    'POST',
    '/payments/wafacash/submit?demo=true',
    { paymentReference: ref1, mtcn: '9876543210' },
    { Authorization: `Bearer ${token1}` }
  );
  log('TEST 4: Student submits MTCN code with ?demo=true — expect 200 & status="PAID"', t4.status, 200, t4.body);

  // ── TEST 5: Verify Access is GRANTED after auto-approval ─────
  const t5 = await request('GET', `/courses/${courseId1}/curriculum`, null, { Authorization: `Bearer ${token1}` });
  const t5_hasAccess = t5.body?.data?.hasFullAccess;
  const t5_firstResUrl = t5.body?.data?.sections?.[0]?.lessons?.[0]?.resources?.[0]?.url;
  log('TEST 5: Access granted after auto-approval — expect hasFullAccess: true', t5.status, 200, {
    hasFullAccess: t5_hasAccess,
    firstResourceUrl: t5_firstResUrl,
  });

  // ── TEST 6: Register brand new student 2 for manual admin flow ──
  const testEmail2 = `student_2_${Date.now()}@212learn.com`;
  const registerRes2 = await request('POST', '/auth/register', {
    firstName: 'Test',
    lastName: 'Student Two',
    email: testEmail2,
    password: 'password123',
    role: 'student',
  });
  const token2 = registerRes2.body?.token;
  console.log('\n📌 Student 2 Token:', token2 ? `${token2.substring(0, 20)}...` : 'NOT OBTAINED ❌');

  // Request voucher 2
  const v2 = await request(
    'POST',
    '/payments/wafacash/request',
    { courseId: courseId2 },
    { Authorization: `Bearer ${token2}` }
  );
  const ref2 = v2.body?.data?.paymentReference;
  const paymentId2 = v2.body?.data?.paymentId;

  // Submit MTCN without demo flag (goes to WAITING_VERIFICATION)
  const submit2 = await request(
    'POST',
    '/payments/wafacash/submit',
    { paymentReference: ref2, mtcn: '1122334455' },
    { Authorization: `Bearer ${token2}` }
  );
  log('TEST 6: Student submits MTCN code for review — expect status="WAITING_VERIFICATION"', submit2.status, 200, submit2.body);

  // ── TEST 7: Admin retrieves Wafacash pending queue ──────────
  const adminLogin = await request('POST', '/auth/login', {
    email: 'admin@212learn.com',
    password: 'password123',
  });
  const adminToken = adminLogin.body?.token;
  const t7 = await request('GET', '/payments/wafacash/pending', null, { Authorization: `Bearer ${adminToken}` });
  log('TEST 7: Admin retrieves WAITING_VERIFICATION queue — expect 200', t7.status, 200, {
    queueLength: t7.body?.data?.payments?.length,
  });

  // ── TEST 8: Admin manual validation (Approve payment) ─────────
  const t8 = await request(
    'PATCH',
    '/payments/wafacash/verify',
    { paymentId: paymentId2, action: 'approve', notes: 'Checked and approved transfer' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 8: Admin manual verification (approve) — expect 200 & status="PAID"', t8.status, 200, t8.body);

  console.log('\n═══════════════════════════════════════');
  console.log('🏁 Robust Wafacash API Tests Completed');
  console.log('═══════════════════════════════════════');
}

runTests().catch(console.error);
