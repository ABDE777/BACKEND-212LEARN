# 212Learning E-Learning Platform Backend API (MVP)

RESTful API backend for the **212Learning** online learning management platform, built using Node.js, Express, Prisma ORM, and PostgreSQL (hosted on Neon DB), with Cloudinary media storage.

---

## ⚡ Tech Stack & Architecture

- **Runtime**: Node.js (ES Modules, `"type": "module"`)
- **Web Framework**: Express.js
- **Database**: PostgreSQL (Neon Database Cloud)
- **ORM**: Prisma Client v7
- **Media Hosting**: Cloudinary (for curriculum PDFs, ZIP archives, images, and video assets)
- **Documentation**: Swagger UI & OpenAPI Specification v3
- **Deployment**: Serverless Functions on Vercel

---

## 🌟 Implemented Features (Sprints 1, 2, & 3)

### 🔐 Sprint 1: Security, Auth & Category Trees
- **JWT Authentication**: Full signup, login, and profile fetching. Password hashing using `bcryptjs`.
- **Role-Based Access Control (RBAC)**: Custom middlewares protecting routes based on roles (`visitor`, `student`, `instructor`, `admin`).
- **Category Tree Engine**: Supports multi-level nesting of parent-child course categories (`GET /categories` returns a clean nested tree).
- **Diagnostics API**: Endpoint checking DB connectivity and row metrics.

### 📚 Sprint 2: Course Catalog & Instructor Tools
- **Course Administration**: Instructors and admins can create draft courses, modify details, and configure levels, pricing, or languages.
- **Catalog Navigation**: Public endpoint to list published courses with paginated search and filters (category, language, level).
- **Admin approval**: `POST /courses/:id/publish` transitions draft courses into the public catalog.

### ⏳ Sprint 3: Pedagogical Content Hierarchy & Files
- **Curriculum Builder**: Full hierarchical structure support: `Courses -> Sections -> Lessons`. Includes position-based sorting and auto-indexing.
- **Asset Attachment System**: Connects Cloudinary storage to Multer middleware, supporting secure uploads of videos, PDF files, zip folders, and slides (max size 200MB) or external links.
- **Assignments Workspace**:
  - Instructors can create homework tasks with deadlines.
  - Students can submit completed tasks (direct uploads or URLs).
  - Instructors can review and issue grades (0–100%) with written feedback.

---

## 🚀 Environment Variables (`.env`)

Create a `.env` file in the root of the `SERVER` directory with the following variables:

```env
# Server Port
PORT=5000

# Environment
NODE_ENV=development

# Neon Database URL
DATABASE_URL="postgresql://username:password@hostname/dbname?sslmode=require"

# JWT Configuration
JWT_SECRET="your-jwt-secret-key-here"
JWT_EXPIRES_IN="7d"

# Cloudinary Credentials
CLOUDINARY_CLOUD_NAME="your-cloudinary-cloud-name"
CLOUDINARY_API_KEY="your-cloudinary-api-key"
CLOUDINARY_API_SECRET="your-cloudinary-api-secret"
```

---

## 🛠️ Getting Started & Local Development

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Database Schema & Seeder
Verify your schema matches the database or migrate it:
```bash
npx prisma generate
npx prisma db seed
```
*The database seeder generates structured mock profiles for all 25 system tables.*

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

## 🧪 E2E Verification Testing

A pre-packaged integration test script is available in the codebase to run full E2E validation against all implemented APIs from Sprints 1 to 3.

To run it:
1. Make sure the local server is running (`npm run dev`).
2. Run the test runner:
   ```bash
   node scripts/test-api.js
   ```

The script will register test accounts, log in, create catalog items, upload sample files to Cloudinary, submit mock student homework, and verify the grading flow, indicating errors or logging `ALL TESTS PASSED SUCCESSFULLY!`.
