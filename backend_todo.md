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

## ⏳ Sprint 4: Stripe Payment & Access Control
> Goal: Payment gateway integration and enrollment access control.

- [ ] `POST /api/v1/payments/checkout-session` — Create Stripe checkout session
- [ ] `POST /api/v1/payments/webhook` — Handle Stripe webhook events
- [ ] On `payment_intent.succeeded` → create `Enrollment` + update `Payment` table
- [ ] Enrollment access middleware — block unenrolled students from lesson resources

---

## ⏳ Sprint 5: Quiz Engine & AI Generation
> Goal: Manual and AI-generated quizzes with student attempts.

- [ ] `POST /api/v1/lessons/:lessonId/quizzes` — Create a quiz manually
- [ ] `POST /api/v1/quizzes/:quizId/questions` — Add questions (MCQ, options, answer)
- [ ] `POST /api/v1/lessons/:lessonId/quizzes/generate-ai` — AI-generated quiz (OpenAI/Claude)
- [ ] `POST /api/v1/quizzes/:quizId/attempts` — Submit answers, calculate score, store attempt

---

## ⏳ Sprint 6: Engagement, Gamification & Reviews
> Goal: Progression tracking, badges, reviews, notifications.

- [ ] `POST /api/v1/lessons/:lessonId/progress` — Log progress / mark lesson complete
- [ ] Gamification engine — award points on quiz attempts & lesson completion
- [ ] `GET /api/v1/users/:userId/achievements` — Fetch points & unlocked badges
- [ ] `POST /api/v1/courses/:courseId/reviews` — Student star review submission
- [ ] Notification dispatcher — Socket.io or REST polling for in-app alerts

---

## ⏳ Sprint 7: Live Meetings & Analytics
> Goal: Live sessions management, instructor analytics, admin portal.

- [ ] `POST /api/v1/courses/:courseId/meetings` — Post Zoom/Meet link & date
- [ ] `GET /api/v1/instructor/analytics/revenue` — Monthly revenue trends
- [ ] `GET /api/v1/instructor/analytics/students` — Active students metrics
- [ ] `GET /api/v1/instructor/analytics/completion` — Course completion rates
- [ ] Admin moderation endpoints — instructor KYC, refund processing, audit logs
