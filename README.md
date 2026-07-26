# 212LEARN E-Learning Platform Backend API (MVP)

RESTful API backend for the **212LEARN** (EduTrack) online learning management platform, built using Node.js, Express, Prisma ORM, and PostgreSQL, with Cloudinary media storage, Wafacash Moroccan manual payment tracking, and Gemini-powered AI quiz generation.

---

## ⚡ Tech Stack & Architecture

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Web Framework**: Express.js
- **Database**: PostgreSQL (Neon Database Cloud or local PostgreSQL instance)
- **ORM**: Prisma Client v7
- **Media Hosting**: Cloudinary (for curriculum PDFs, ZIP archives, images, and video assets)
- **AI Integration**: Google Gemini API (`gemini-2.0-flash` with dynamic local fallback)
- **Documentation**: Swagger UI & OpenAPI Specification v3
- **Deployment**: Serverless Functions on Vercel

---

## 🌟 Implemented Features (Sprints 1 to 8)

### 🔐 Sprint 1: Security, Auth & Category Trees
- **JWT Authentication**: Full signup, login, and profile fetching. Password hashing using `bcryptjs`.
- **Role-Based Access Control (RBAC)**: Custom middlewares protecting routes based on roles (`visitor`, `student`, `instructor`, `admin`).
- **Category Tree Engine**: Supports multi-level nesting of parent-child course categories (`GET /categories` returns a clean nested tree).

### 📚 Sprint 2: Course Catalog & Instructor Tools
- **Course Administration**: Instructors and admins can create draft courses, modify details, and configure levels, pricing, or languages.
- **Catalog Navigation**: Public endpoint to list published courses with paginated search and filters (category, language, level).
- **Admin Approval**: `POST /courses/:id/publish` transitions draft courses into the public catalog.

### ⏳ Sprint 3: Pedagogical Content Hierarchy & Files
- **Curriculum Builder**: Full hierarchical structure support: `Courses -> Sections -> Lessons`. Includes position-based sorting and auto-indexing.
- **Asset Attachment System**: Connects Cloudinary storage to Multer middleware, supporting secure uploads of videos, PDF files, ZIP folders, and slides (max size 200MB) or external links.
- **Assignments Workspace**:
  - Instructors can create homework tasks with deadlines.
  - Students can submit completed tasks (direct uploads or URLs).
  - Instructors can review and issue grades (0–100%) with written feedback.

### 💸 Sprint 4: Wafacash Moroccan Payment System & Paywall
- **Wafacash manual cash payment**: Complete localized manual cash transfer system (`PENDING` -> `WAITING_VERIFICATION` -> `PAID` / `REJECTED` / `REFUNDED`).
- **Verification**: Student submits 10-digit MTCN code and receipt photo (stored in Cloudinary).
- **Access Paywall**: Middleware (`checkEnrollment`) blocks access to pedagogical resources unless the enrollment's payment is `'PAID'`.
- **Curriculum URL Redaction**: Redacts resource links to guest/unpaid users, returning `"ENROLLMENT_REQUIRED"`.

### 🧠 Sprint 5: Quiz Engine & AI Generation
- **MCQ Quizzes**: Support for manually created quizzes and AI-generated quizzes leveraging Google Gemini API (`gemini-2.0-flash`) with dynamic local fallback.
- **Quiz Evaluations**: safe submission handling that validates student responses and dynamically calculates passing scores.

### 🏆 Sprint 6: Gamification, Reviews & Notifications
- **Badge Engine**: Automatic background badge granting (🥇 *First Steps*, 🏆 *Quiz Master*, 🎓 *Course Finisher* with PDF certificate generation).
- **Dynamic Points**: Dynamic points calculation on dashboard fetch (10 pts per completed lesson, 20/50 pts per quiz score).
- **Reviews**: Enrolled (PAID) students can rate courses with smart updates (re-submission updates reviews without duplicate creation).
- **Notifications**: Integrated in-app notifications with unread counts and read-all markers.

### 📊 Sprint 7: Live Meetings & Analytics Dashboards
- **Sessions Live**: Creation of scheduled live sessions (Zoom / Google Meet) for a course, sending notifications to all enrolled students automatically.
- **Instructor Analytics**: Monthly revenue trends, top courses, student counts, and completion rates.

### 🛡️ Sprint 8: Admin Moderation, Refunds & Auditing
- **KYC Approvals**: Admins can fetch and verify/revoke instructor profiles.
- **Refund System**: Admin can refund a payment (`REFUNDED`), which revokes student course access instantly.
- **Audit Logging**: All admin actions are tracked in a dedicated `AuditLog` table.

### 🔒 Security Hardening & Improvements
- **Draft Course Protection**: Anonymous users and non-enrolled students cannot access draft course content. Draft courses expose limited details (no sections/lessons) even to authorized users.
- **Meetings Access Control**: Course meetings are only accessible to enrolled students (PAID status), course instructors, and admins.
- **Role Escalation Prevention**: Public registration is forced to create student accounts only - users cannot self-assign admin/instructor roles.
- **Soft-Delete Auth Enforcement**: Soft-deleted users are rejected during login and in auth middleware, preventing account reuse.
- **Full-Fetch Contract**: Pagination supports `limit=-1` and `limit=0` to return all records without pagination.
- **Deterministic Progress**: Lesson progress entries have unique constraints on `(userId, lessonId)` to prevent duplicates.

---

## 🚀 Environment Variables (`.env`)

Create a `.env` file in the root of the `SERVER` directory with the following variables:

```env
# Server Port
PORT=5000

# Environment
NODE_ENV=development

# Database URL (Neon or Local PostgreSQL)
DATABASE_URL="postgresql://username:password@localhost:5432/dbname?schema=public"

# JWT Configuration
JWT_SECRET="your-jwt-secret-key-here"
JWT_EXPIRES_IN="7d"

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"

# Frontend Application URL
FRONTEND_URL=http://localhost:5173

# Wafacash Simulation (For academic presentation / soutenance)
WAFACASH_AUTO_APPROVE=false # Set to false to require manual validation by default (demo=true parameter still works in dev)

# Google Gemini API Key
GEMINI_API_KEY=your-api-key
```

---

## 🛠️ Getting Started & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database Schema & Seeder
Verify your schema matches the database, apply updates and run the seed script:
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```
*The database seeder generates structured mock profiles for all system tables.*

### 3. Start Development Server
```bash
npm run dev
```
The server will boot on `http://localhost:5000` with hot reloading enabled.

---

## 📖 Live API Documentation

Once the server is running, explore and test the endpoints directly via the Swagger UI:
- **Interactive OpenAPI UI**: [http://localhost:5000/api-docs](http://localhost:5000/api-docs)
- **Raw Spec JSON**: `http://localhost:5000/api-docs.json`
- **Live Vercel Production API**: [https://backend-212learn.vercel.app](https://backend-212learn.vercel.app)

---

## 🧪 Testing

### Automated Test Suites
The project includes comprehensive test scripts for validating functionality and security:

```bash
# Run all sprint tests
npm test

# Run individual sprint tests
npm run test:sprint6  # Gamification, Reviews & Notifications
npm run test:sprint7  # Analytics & Meetings
npm run test:sprint8  # Admin Moderation, KYC, Refunds & Auditing

# Run security regression tests
npm run test:security
```

### Legacy Test Scripts
For direct execution of individual test files:
```bash
# Wafacash Checkout & Middleware Paywall
node wafacash_test.js

# Quiz Engine & AI Generation (Gemini)
node quiz_test.js

# Sprint tests (also available via npm scripts)
node sprint6_test.js
node sprint7_test.js
node sprint8_test.js
```

**Note**: Ensure the server is running (`npm run dev`) before executing tests.
