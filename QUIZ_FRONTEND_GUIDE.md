# 212LEARN — Quiz Feature Guide for Frontend Developers

> **Full handoff (uploads, paywall, all endpoints):** [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md)

> **Status:** Quiz + AI endpoints verified against the API.  
> **Base URL (dev):** `http://localhost:5000/api/v1`  
> **Base URL (prod):** `https://backend-212learn.vercel.app/api/v1`  
> **Auth:** Every quiz mutation / attempt route requires `Authorization: Bearer <JWT>`  
> **Envelope:** `{ "success": true, "data": { ... } }`  
> **AI failure:** Missing/failed Groq → **503** `SERVICE_UNAVAILABLE` (no mock questions).

This document describes how quizzes work end-to-end so you can build the **Instructor AI Quiz Builder** and the **Student Quiz Player**.

---

## 1. Product flow (high level)

```
Instructor                          Student
──────────                          ───────
Create quiz (manual OR AI)
        │
Add / edit / delete questions
        │
Publish quiz (validationStatus = "approved")
        │
        └──────────────────────────► List course quizzes
                                     Open quiz (no correct answers)
                                     Submit answers
                                     See score + breakdown
```

### Quiz lifecycle (`validationStatus`)

| Status       | Meaning                                      | Student can attempt? |
|--------------|----------------------------------------------|----------------------|
| `draft`      | Created, still being edited                  | No                   |
| `pending`    | Waiting for review (optional workflow)       | No                   |
| `approved`   | Published — available to students            | **Yes**              |
| `rejected`   | Rejected / not usable                        | No                   |

Students get `403` if they try to submit an attempt on a non-`approved` quiz.

Pass rule: **score ≥ 60%** → `passed: true`.

---

## 2. Suggested frontend screens

| Screen | Suggested route | Role | Backend used |
|--------|-----------------|------|--------------|
| AI / Manual Quiz Builder | `/instructor/lesson/:lessonId/quiz` | instructor, admin | create, generate-ai, add/edit/delete questions, publish |
| Course quiz list | `/classroom/:courseId` or `/learn/:courseId` | student | `GET /courses/:courseId/quizzes` |
| Quiz Player | `/quiz/:quizId` or `/learn/:courseId/quiz/:quizId` | student | `GET /quizzes/:quizId` + `POST /quizzes/:quizId/attempts` |

---

## 3. Instructor flow

### 3.1 Option A — Manual quiz

**Step 1 — Create empty quiz (draft)**

```http
POST /api/v1/lessons/:lessonId/quizzes
Authorization: Bearer <instructor_or_admin_token>
Content-Type: application/json

{
  "title": "Variables JavaScript"
}
```

**Response `201`**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "lessonId": "uuid",
    "title": "Variables JavaScript",
    "validationStatus": "draft"
  }
}
```

**Step 2 — Add questions (repeat)**

```http
POST /api/v1/quizzes/:quizId/questions
Authorization: Bearer <instructor_or_admin_token>
Content-Type: application/json

{
  "statement": "Quelle syntaxe déclare une variable modifiable en JS moderne ?",
  "options": ["const", "let", "var", "global"],
  "correctAnswer": "let"
}
```

Rules:
- `options` must be an array with **at least 2** strings
- `correctAnswer` must **exactly match** one option (string equality)

**Step 3 — Publish**

```http
PATCH /api/v1/quizzes/:quizId
Authorization: Bearer <instructor_or_admin_token>
Content-Type: application/json

{
  "validationStatus": "approved"
}
```

Optional: also send `"title": "New title"` to rename.

---

### 3.2 Option B — AI-generated quiz (Groq)

Uses **Groq** (`llama-3.3-70b-versatile`) on the backend. Frontend only sends a topic prompt — **do not call Groq from the browser**.

```http
POST /api/v1/lessons/:lessonId/quizzes/generate-ai
Authorization: Bearer <instructor_or_admin_token>
Content-Type: application/json

{
  "title": "AI Quick Quiz: Closures",
  "prompt": "Closures, scope chain, lexical scoping, and encapsulation in JavaScript.",
  "questionCount": 5
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `title` | yes | Quiz title |
| `prompt` | yes | Topic / lesson text the AI should use |
| `questionCount` | no | Default `5`, min `1`, max `20` |

**Response `201`**

```json
{
  "success": true,
  "data": {
    "message": "AI generated 5 questions. Review and edit before publishing.",
    "quiz": {
      "id": "uuid",
      "lessonId": "uuid",
      "title": "AI Quick Quiz: Closures",
      "validationStatus": "draft"
    },
    "questions": [
      {
        "id": "uuid",
        "quizId": "uuid",
        "statement": "What is a closure?",
        "options": ["A", "B", "C", "D"],
        "correctAnswer": "A"
      }
    ]
  }
}
```

**UX recommendations for AI Builder**
1. Show a loading state (AI call can take a few seconds).
2. After success, show an editable list of questions (statement, 4 options, correct answer).
3. Allow edit / delete / add more questions before publish.
4. Only then call `PATCH` with `validationStatus: "approved"`.
5. If API returns `503` with message about `GROQ_API_KEY`, show “AI temporarily unavailable”.

**Fallback behavior (backend):** if Groq fails/rate-limits, the API still returns `201` with mock questions. Treat the response the same way (always let the instructor review).

---

### 3.3 Edit / delete questions

```http
PATCH /api/v1/questions/:questionId
{
  "statement": "...",
  "options": ["A", "B", "C", "D"],
  "correctAnswer": "B"
}
```

```http
DELETE /api/v1/questions/:questionId
→ 204 No Content
```

```http
DELETE /api/v1/quizzes/:quizId
→ 204 No Content
```

---

### 3.4 Preview quiz as instructor

```http
GET /api/v1/quizzes/:quizId
Authorization: Bearer <instructor_or_admin_token>
```

Instructors/admins receive **`correctAnswer`** on each question (for editing).  
Students do **not**.

---

## 4. Student flow

### 4.1 List quizzes for a course

```http
GET /api/v1/courses/:courseId/quizzes
Authorization: Bearer <token>   (optional but recommended so lastAttempt is filled)
```

**Response shape**

```json
{
  "success": true,
  "data": {
    "courseId": "uuid",
    "quizzes": [
      {
        "id": "uuid",
        "title": "Variables JavaScript",
        "validationStatus": "approved",
        "questionCount": 5,
        "lessonId": "uuid",
        "lessonTitle": "Intro",
        "sectionId": "uuid",
        "sectionTitle": "Module 1",
        "lastAttempt": {
          "id": "uuid",
          "score": "100.00",
          "duration": 45,
          "attemptDate": "2026-..."
        }
      }
    ]
  }
}
```

**UI tip:** only enable “Take quiz” when `validationStatus === "approved"`. Draft quizzes may still appear in the list for instructors — for students, filter to `approved` only if you want a clean list.

### 4.2 Load quiz for the player

```http
GET /api/v1/quizzes/:quizId
Authorization: Bearer <student_token>
```

Student payload: questions have `id`, `statement`, `options` — **no `correctAnswer`**.

Render MCQ UI from `options`. Track selections as:

```ts
type Answer = { questionId: string; selectedAnswer: string };
```

`selectedAnswer` must be the **exact option string**, not an index.

### 4.3 Submit attempt

```http
POST /api/v1/quizzes/:quizId/attempts
Authorization: Bearer <student_token>
Content-Type: application/json

{
  "answers": [
    { "questionId": "uuid", "selectedAnswer": "let" }
  ],
  "duration": 180
}
```

| Field | Required | Notes |
|-------|----------|--------|
| `answers` | yes | Non-empty array |
| `duration` | no | Seconds spent (for analytics/UX) |

**Role:** only `student` can submit (`restrictTo('student')`).

**Response `201`**

```json
{
  "success": true,
  "data": {
    "attemptId": "uuid",
    "score": 100,
    "correctCount": 1,
    "totalCount": 1,
    "percentage": "100.0%",
    "passed": true,
    "duration": 180,
    "breakdown": [
      {
        "questionId": "uuid",
        "statement": "...",
        "options": ["const", "let", "var", "global"],
        "selectedAnswer": "let",
        "correctAnswer": "let",
        "isCorrect": true
      }
    ]
  }
}
```

Use `breakdown` for the results screen (green/red per question).  
Scoring is **always server-side** — never trust client-side grading.

Gamification (badges like “Quiz Master”) runs in the background after submit; no extra frontend call required.

---

## 5. Auth & permissions cheat sheet

| Endpoint | Method | Roles |
|----------|--------|-------|
| `/lessons/:lessonId/quizzes` | POST | instructor, admin |
| `/lessons/:lessonId/quizzes/generate-ai` | POST | instructor, admin |
| `/quizzes/:quizId/questions` | POST | instructor, admin |
| `/quizzes/:quizId` | GET | any authenticated |
| `/quizzes/:quizId` | PATCH | instructor, admin |
| `/quizzes/:quizId` | DELETE | instructor, admin |
| `/questions/:questionId` | PATCH / DELETE | instructor, admin |
| `/quizzes/:quizId/attempts` | POST | **student only** |
| `/courses/:courseId/quizzes` | GET | optional auth |

Instructors must manage quizzes for courses they own (or be admin). Otherwise expect `403`.

---

## 6. Error handling (frontend)

Typical response:

```json
{
  "success": false,
  "message": "...",
  "code": "VALIDATION_ERROR"
}
```

| HTTP | When | UI suggestion |
|------|------|----------------|
| `400` | Missing fields, bad options, empty answers | Inline form errors |
| `401` | Missing/invalid JWT | Redirect to login |
| `403` | Wrong role, or quiz not approved | Toast: “Quiz not available” |
| `404` | Bad lesson/quiz id | Empty state |
| `503` | AI not configured (`GROQ_API_KEY`) | Disable AI button / show fallback CTA to manual create |

---

## 7. Minimal TypeScript types

```ts
type QuizStatus = 'draft' | 'pending' | 'approved' | 'rejected';

interface Quiz {
  id: string;
  lessonId: string;
  title: string;
  validationStatus: QuizStatus;
}

interface Question {
  id: string;
  quizId: string;
  statement: string;
  options: string[];
  correctAnswer?: string; // only for instructor/admin
}

interface QuizAttemptPayload {
  answers: { questionId: string; selectedAnswer: string }[];
  duration?: number;
}

interface QuizAttemptResult {
  attemptId: string;
  score: number;
  correctCount: number;
  totalCount: number;
  percentage: string;
  passed: boolean;
  duration: number | null;
  breakdown: {
    questionId: string;
    statement: string;
    options: string[];
    selectedAnswer: string | null;
    correctAnswer: string;
    isCorrect: boolean;
  }[];
}
```

---

## 8. Example Axios helpers

```ts
const api = axios.create({ baseURL: import.meta.env.VITE_API_URL + '/api/v1' });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Instructor — AI generate
export const generateAIQuiz = (lessonId: string, body: {
  title: string;
  prompt: string;
  questionCount?: number;
}) => api.post(`/lessons/${lessonId}/quizzes/generate-ai`, body);

// Instructor — publish
export const publishQuiz = (quizId: string) =>
  api.patch(`/quizzes/${quizId}`, { validationStatus: 'approved' });

// Student — load + submit
export const getQuiz = (quizId: string) => api.get(`/quizzes/${quizId}`);
export const submitQuizAttempt = (quizId: string, payload: QuizAttemptPayload) =>
  api.post(`/quizzes/${quizId}/attempts`, payload);

// Course quiz list
export const listCourseQuizzes = (courseId: string) =>
  api.get(`/courses/${courseId}/quizzes`);
```

Always unwrap with `response.data.data` (backend envelope).

---

## 9. Demo credentials (local seed)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin1@212learn.com` | `password123` |
| Instructor | `instructor1@212learn.com` | `password123` |
| Student | `student1@212learn.com` | `password123` |

---

## 10. Quick checklist for frontend delivery

**Instructor**
- [ ] Form: title + prompt + question count → call `generate-ai`
- [ ] Or: create empty quiz → add questions one by one
- [ ] Review/edit questions UI (show correct answers)
- [ ] Publish button → `validationStatus: "approved"`
- [ ] Loading + error states for AI (`503`)

**Student**
- [ ] Course quiz list (`approved` only)
- [ ] Player: show statement + options, no correct answers
- [ ] Submit answers with exact option strings + optional `duration`
- [ ] Results screen from `score`, `passed`, `breakdown`
- [ ] Handle `403` if quiz not published yet

---

## 11. Verified test result (backend)

Ran `node quiz_test.js` against local server:

| # | Scenario | Result |
|---|----------|--------|
| 1 | Create quiz manually | PASS `201` |
| 2 | Add question | PASS `201` |
| 3 | Student GET hides `correctAnswer` | PASS `200` |
| 4 | Approve quiz | PASS `200` |
| 5 | Student submit attempt (100%) | PASS `201` |
| 6 | AI generate quiz (Groq) | PASS `201` |

Interactive docs while server is running: [http://localhost:5000/api-docs](http://localhost:5000/api-docs) (tag **Quizzes**).
