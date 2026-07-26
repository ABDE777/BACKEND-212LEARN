import http from 'http';

const BASE = 'http://localhost:5000/api/v1';
const DEMO_USERS = {
  admin: 'admin1@212learn.com',
  student: 'student1@212learn.com',
};

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
  console.log('🚀 Starting Sprint 5 Quiz Engine & AI Generation Tests...\n');

  // ── SETUP: Login Admin / Instructor ─────────────────────────
  const adminLogin = await request('POST', '/auth/login', {
    email: DEMO_USERS.admin,
    password: 'password123',
  });
  const adminToken = adminLogin.body?.token;
  console.log('📌 Admin Token:', adminToken ? `${adminToken.substring(0, 20)}...` : 'NOT OBTAINED ❌');

  // ── SETUP: Login Student ─────────────────────────────────────
  const studentLogin = await request('POST', '/auth/login', {
    email: DEMO_USERS.student,
    password: 'password123',
  });
  const studentToken = studentLogin.body?.token;
  console.log('📌 Student Token:', studentToken ? `${studentToken.substring(0, 20)}...` : 'NOT OBTAINED ❌');

  // Fetch course & lessons to find a valid lessonId
  const coursesRes = await request('GET', '/courses');
  const courseId = coursesRes.body?.data?.courses?.[0]?.id;
  const curriculumRes = await request('GET', `/courses/${courseId}/curriculum`, null, { Authorization: `Bearer ${adminToken}` });
  const lessonId = curriculumRes.body?.data?.sections?.[0]?.lessons?.[0]?.id;
  console.log('📌 Using Lesson ID:', lessonId);

  if (!lessonId) {
    console.error('Cannot run quiz tests without a valid lesson ID.');
    process.exit(1);
  }

  // ── TEST 1: Create Quiz Manually (Instructor/Admin) ─────────
  const t1 = await request(
    'POST',
    `/lessons/${lessonId}/quizzes`,
    { title: 'Pratique des Variables JS' },
    { Authorization: `Bearer ${adminToken}` }
  );
  const quizId = t1.body?.data?.id;
  log('TEST 1: Create Quiz Manually (Draft) — expect 201 Created', t1.status, 201, t1.body);

  // ── TEST 2: Add Question to Quiz (Instructor/Admin) ──────────
  const t2 = await request(
    'POST',
    `/quizzes/${quizId}/questions`,
    {
      statement: 'Quelle syntaxe déclare une variable modifiable en JS modern?',
      options: ['const', 'let', 'var', 'global'],
      correctAnswer: 'let',
    },
    { Authorization: `Bearer ${adminToken}` }
  );
  const questionId = t2.body?.data?.id;
  log('TEST 2: Add Question manually to Quiz — expect 201 Created', t2.status, 201, t2.body);

  // ── TEST 3: Get Quiz as Student (correctAnswer should be hidden) ──
  const t3 = await request('GET', `/quizzes/${quizId}`, null, { Authorization: `Bearer ${studentToken}` });
  log(
    'TEST 3: Get Quiz questions (correctAnswer should be hidden) — expect 200 OK',
    t3.status,
    200,
    {
      title: t3.body?.data?.title,
      firstQuestionStatement: t3.body?.data?.questions?.[0]?.statement,
      firstQuestionOptions: t3.body?.data?.questions?.[0]?.options,
      correctAnswerExposed: t3.body?.data?.questions?.[0]?.correctAnswer !== undefined,
    }
  );

  // ── TEST 4: Publish Quiz (Approve validationStatus) ─────────
  const t4 = await request(
    'PATCH',
    `/quizzes/${quizId}`,
    { validationStatus: 'approved' },
    { Authorization: `Bearer ${adminToken}` }
  );
  log('TEST 4: Approve/Publish Quiz — expect 200 OK', t4.status, 200, t4.body);

  // ── TEST 5: Submit Quiz Attempt (Student) ────────────────────
  const t5 = await request(
    'POST',
    `/quizzes/${quizId}/attempts`,
    {
      answers: [
        { questionId: questionId, selectedAnswer: 'let' } // Correct answer
      ],
      duration: 45
    },
    { Authorization: `Bearer ${studentToken}` }
  );
  log('TEST 5: Student submits quiz attempt (score should be 100%) — expect 201 Created', t5.status, 201, t5.body);

  // ── TEST 6: Generate Quiz via Gemini AI (Instructor/Admin) ──
  console.log('\n🧠 Generating AI Quiz using Google Gemini API (may take a few seconds)...');
  const t6 = await request(
    'POST',
    `/lessons/${lessonId}/quizzes/generate-ai`,
    {
      title: 'AI Quick Quiz: Advanced JavaScript Closures',
      prompt: 'Closures, scope chain, lexical scoping, and encapsulation in JavaScript.',
      questionCount: 3
    },
    { Authorization: `Bearer ${adminToken}` }
  );
  log(
    'TEST 6: AI-generated quiz creation — expect 201 Created',
    t6.status,
    201,
    {
      message: t6.body?.data?.message,
      quizTitle: t6.body?.data?.quiz?.title,
      questionsCount: t6.body?.data?.questions?.length,
      firstAIQuestion: t6.body?.data?.questions?.[0]?.statement,
      options: t6.body?.data?.questions?.[0]?.options,
      correctAnswer: t6.body?.data?.questions?.[0]?.correctAnswer,
    }
  );

  console.log('\n═══════════════════════════════════════');
  console.log('🏁 Quiz & AI Engine API Tests Completed');
  console.log('═══════════════════════════════════════');
}

runTests().catch(console.error);
