# 212LEARN — Backend Sprint TODO List

---

## ✅ Sprint 1: Foundations & Auth
> Goal: Project setup, authentication, and course categories.

- [x] Initialize Prisma schema & sync to Neon PostgreSQL
- [x] Configure JWT secret & environment variables
- [x] `POST /api/v1/auth/register` — User registration (Student, Instructor, Admin)
- [x] `POST /api/v1/auth/login` — Issue JWT token
- [x] `GET /api/v1/auth/me` — Get current authenticated user
- [x] Auth middleware — `protect` (JWT verify)
- [x] Auth middleware — `restrictTo(...roles)` (RBAC)
- [x] `GET /api/v1/categories` — Nested parent-child tree
- [x] `POST /api/v1/categories` (Admin) — Create category
- [x] Database seeder — full test data for all 25 tables
- [x] Deploy backend on Vercel (`https://backend-212learn.vercel.app`)
- [x] Swagger UI configured & live at `/api-docs`

---

## ✅ Sprint 2: Course Catalog & Instructor Space
> Goal: Instructors create courses, students browse the catalog.

- [x] `GET /api/v1/courses` — List published courses (pagination, filters: category, level, language, status)
- [x] `GET /api/v1/courses/search?q=` — Full-text search on title & description
- [x] `GET /api/v1/courses/:id` — Course details (sections, reviews, instructor)
- [x] `POST /api/v1/courses` (Instructor/Admin) — Create draft course
- [x] `PATCH /api/v1/courses/:id` (Instructor/Admin) — Update course fields
- [x] `DELETE /api/v1/courses/:id` (Admin) — Soft-delete a course
- [x] `POST /api/v1/courses/:id/publish` (Admin) — Publish a draft course
- [x] Swagger documentation fully updated (all schemas, tags, servers)

---

## ✅ Sprint 3: Pedagogical Content Hierarchy
> Goal: Sections, Lessons, Resources, Assignments & Submissions.

- [x] `GET /api/v1/courses/:courseId/curriculum` — Full section → lesson tree
- [x] `POST /api/v1/courses/:courseId/sections` (Instructor) — Create section
- [x] `PATCH /api/v1/sections/:id` (Instructor) — Update section / reorder
- [x] `DELETE /api/v1/sections/:id` (Instructor/Admin) — Delete section
- [x] `POST /api/v1/sections/:sectionId/lessons` (Instructor) — Create lesson
- [x] `PATCH /api/v1/lessons/:id` (Instructor) — Update lesson / reorder
- [x] `DELETE /api/v1/lessons/:id` (Instructor/Admin) — Delete lesson
- [x] Cloudinary integration for file uploads
- [x] `POST /api/v1/lessons/:lessonId/resources` — Attach video/PDF/ZIP/link
- [x] `DELETE /api/v1/resources/:id` (Instructor/Admin) — Remove resource
- [x] `POST /api/v1/lessons/:lessonId/assignments` (Instructor) — Create assignment
- [x] `GET /api/v1/lessons/:lessonId/assignments` (Auth) — List assignments
- [x] `POST /api/v1/assignments/:assignmentId/submissions` (Student) — Submit work
- [x] `GET /api/v1/assignments/:assignmentId/submissions` (Instructor/Admin) — List submissions
- [x] `PATCH /api/v1/submissions/:id/grade` (Instructor) — Grade & feedback

---

## ✅ Sprint 4: Wafacash Payment & Access Control (COMPLETED — 8/8 Tests Passed ✅)
> Goal: Moroccan Wafacash manual cash payment workflow and enrollment access control.
> Payment Statuses: `PENDING` → `WAITING_VERIFICATION` → `PAID` / `REJECTED` / `REFUNDED`

**Wafacash Payment Routes** (`src/routes/wafacash.routes.js`, `src/controllers/wafacash.controller.js`):
- [x] `POST /api/v1/payments/wafacash/request` (Student) — Initialize payment voucher, creates `Enrollment` + `Payment` with status `PENDING`, returns `WFC-XXXXXXXX` reference & MAD amount
- [x] `POST /api/v1/payments/wafacash/submit` (Student) — Upload receipt photo (Cloudinary) + 10-digit MTCN code → moves to `WAITING_VERIFICATION`
- [x] `GET /api/v1/payments/wafacash/pending` (Admin) — List all payments awaiting verification
- [x] `PATCH /api/v1/payments/wafacash/verify` (Admin) — Approve (`PAID`) or reject (`REJECTED`) with optional notes

**Prisma Schema** (`prisma/schema.prisma`):
- [x] Added `mtcn`, `receiptUrl`, `verifiedBy`, `verifiedAt`, `notes` fields to `Payment` model
- [x] `npx prisma db push` + `npx prisma generate` to sync new fields

**Access Control**:
- [x] `checkEnrollment` middleware — blocks access unless `payment.status === 'PAID'`
- [x] `getCurriculum` — resource URLs replaced with `"ENROLLMENT_REQUIRED"` for non-`PAID` students
- [x] `optionalProtect` middleware — curriculum preview works for guests/unenrolled
- [x] CORS updated — `https://212-learn.vercel.app` authorized

**Security & Demo Mode**:
- [x] `?demo=true` on `/submit` enables instant auto-approval (blocked in `NODE_ENV=production`)
- [x] `WAFACASH_AUTO_APPROVE=false` in `.env` — manual admin verification required by default

**Tests**:
- [x] All 8 integration tests PASSED ✅ against local dev server

---

## ✅ Sprint 5: Quiz Engine & AI Generation (COMPLETED — 6/6 Tests Passed ✅)
> Goal: Implement manual and AI-powered MCQ quiz creation, question management, and attempt verification.
> Frontend pages: Quiz Player (`/learn/:courseId/quiz/:quizId`), AI Quiz Builder (`/instructor/lesson/:lessonId/quiz`)

- [x] `GET /api/v1/courses/:courseId/quizzes` — List quizzes for a course (needed by frontend Quiz Player) ✅ NEW
- [x] `PUT /api/v1/submissions/:id/grade` — Added PUT alias alongside PATCH for frontend compatibility ✅ FIXED
- [x] `POST /api/v1/lessons/:lessonId/quizzes` — Create a quiz manually (Instructor)
- [x] `POST /api/v1/quizzes/:quizId/questions` — Add MCQ questions with options & correct answer
- [x] `POST /api/v1/lessons/:lessonId/quizzes/generate-ai` — AI-generated quiz using Google Gemini API with automatic robust fallback simulation
- [x] `GET /api/v1/quizzes/:quizId` — Get quiz with choices (correct answers hidden for students)
- [x] `PATCH /api/v1/quizzes/:quizId` — Publish / approve quiz
- [x] `POST /api/v1/quizzes/:quizId/attempts` — Submit student answers, calculate score, record attempt
- [x] All 6 integration tests PASSED ✅ against local dev server

---

## ✅ Sprint 6: Gamification, Reviews & Notifications (COMPLETED — 9/9 Tests Passed ✅)
> Goal: Progression tracking, badge rewards, course reviews, and notification dispatching.
> Frontend pages: Classroom Player (`/learn/:courseId/lesson/:lessonId`), Student Dashboard (`/student/dashboard`)

- [x] `POST /api/v1/lessons/:lessonId/progress` — Log progress / mark lesson complete ✅ (Classroom Player)
- [x] `GET /api/v1/users/:userId/achievements` — Fetch badges, certs & stats with **dynamic point system** ✅ (Student Dashboard)
- [x] Gamification engine — Auto-award badges on lesson completion & perfect quiz scores
  - [x] 🥇 **"First Steps"** — Unlocks on first completed lesson (+10 pts/lesson)
  - [x] 🏆 **"Quiz Master"** — Unlocks on first 100% quiz score (+50 pts)
  - [x] 🎓 **"Course Finisher"** — Unlocks when all lessons in a course are done → **Auto-generates certificate**
- [x] `GET /api/v1/courses/:courseId/reviews` — List course reviews with average rating (public) ✅
- [x] `POST /api/v1/courses/:courseId/reviews` — Student star review submission (PAID enrollment required) ✅
  - Smart update: if review already exists, it is updated instead of creating a duplicate
  - Instructor receives a notification when a new review is submitted
- [x] `GET /api/v1/users/:userId/notifications` — Fetch notifications with unread count ✅
- [x] `PATCH /api/v1/users/:userId/notifications/read-all` — Mark all notifications as read ✅
- [x] Notification dispatcher — Integrated into gamification engine (badge unlocks, certificate generation, reviews)
- [x] All 9 integration tests PASSED ✅ against local dev server

---

## ✅ Sprint 7: Live Meetings & Analytics (COMPLETED — 10/10 Tests Passed ✅)
> Goal: Live sessions management, instructor analytics, admin portal.

- [x] `POST /api/v1/courses/:courseId/meetings` — Post Zoom/Meet link & date ✅
- [x] `GET /api/v1/instructor/analytics/revenue` — Monthly revenue trends ✅
- [x] `GET /api/v1/instructor/analytics/students` — Active students metrics ✅
- [x] `GET /api/v1/instructor/analytics/completion` — Course completion rates ✅
- [x] `GET /api/v1/courses/:courseId/meetings` — List course meetings (upcoming/past) ✅
- [x] All 10 integration tests PASSED ✅ against local dev server

---

## ✅ Sprint 8: Admin Moderation, Refunds & Auditing (COMPLETED — 10/10 Tests Passed ✅)
> Goal: instructor KYC, refund processing, audit logs.

- [x] Admin KYC Verification endpoints for Instructors (`GET /admin/users/pending-kyc`, `PATCH /admin/users/:userId/verify`) ✅
- [x] Refund processing and validation endpoints (`PATCH /admin/payments/:paymentId/refund`) ✅
- [x] Audit logs viewer / database logger for actions (`GET /admin/audit-logs`, logAuditEvent utility) ✅
- [x] All 10 integration tests PASSED ✅ against local dev server
