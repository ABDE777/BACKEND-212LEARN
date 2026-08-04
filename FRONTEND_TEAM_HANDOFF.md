# 212LEARN — Frontend Team Handoff

**Send this document to the frontend developer.**  
It explains how to integrate with the production backend, the rules that break production if ignored, and a full API catalog.

| | |
|---|---|
| **API base (prod)** | `https://backend-212learn.vercel.app/api/v1` |
| **API base (local)** | `http://localhost:5000/api/v1` |
| **Health** | `GET https://backend-212learn.vercel.app/health` |
| **Backend repo** | this project (`SERVER`) |
| **Auth** | `Authorization: Bearer <jwt>` |
| **Envelope** | `{ success, data, meta? }` / `{ success: false, error: { code, message } }` |

Related docs: [`FRONTEND_API_GUIDE.md`](./FRONTEND_API_GUIDE.md) · [`QUIZ_FRONTEND_GUIDE.md`](./QUIZ_FRONTEND_GUIDE.md) · [`ERROR_CODES.md`](./ERROR_CODES.md) · [`examples/uploadLessonResource.js`](./examples/uploadLessonResource.js)

---

## 1. Quick start

1. Set frontend env: `VITE_API_BASE_URL=https://backend-212learn.vercel.app/api/v1` (or your equivalent).
2. Login → store JWT → send it on every protected request.
3. Treat `error.code` as the machine-readable key for UI messages.
4. Implement **signed Cloudinary upload** for lesson resources (section 3) — multipart to Vercel will 413.
5. Install **Vercel Web Analytics** on the frontend app (section 13).
6. Use seed accounts below for QA against production/staging DB if shared.

### Test accounts (password for all: `password123`)

| Email | Role | Useful for |
|-------|------|------------|
| `admin@212learn.com` | admin | Admin panels, verify payments, publish |
| `instructor@212learn.com` | instructor | Curriculum, quizzes, resources |
| `student1@212learn.com` | student | **PAID** access to React Essentials |
| `student2@212learn.com` | student | Payment pending (`WFC-TESTPEND`) |

Coupon: `TEST10` (10% off).

---

## 2. Response & auth conventions

### Success

```json
{
  "success": true,
  "data": { },
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 20,
    "totalPages": 5,
    "hasNextPage": true,
    "hasPrevPage": false
  }
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "You are not logged in"
  }
}
```

### Headers

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Use `multipart/form-data` only when an endpoint explicitly needs a file field (avatar, Wafacash receipt, small local uploads). Prefer Cloudinary-sign for large lesson files.

### Pagination

- Defaults: `page=1`, `limit=20`, max `limit=100`
- `limit=-1` / `0` (fetch all) is **blocked in production** unless backend enables `ALLOW_UNLIMITED_PAGINATION`

### Request id

Responses / logs may include `X-Request-Id` / `requestId` — useful when reporting bugs.

### CORS

Allowed origins include localhost Vite ports (`5173`–`5175`, `8081`), Lovable, and configured `FRONTEND_URL`.  
If the frontend domain changes, ask backend to add it to CORS + set `FRONTEND_URL` on Vercel (needed for password-reset emails).

---

## 3. CRITICAL — File uploads (Vercel 413)

Vercel serverless body limit ≈ **4.5 MB**. Uploading a 4.7 MB PDF as `multipart` to `/lessons/:id/resources` fails with:

`413 FUNCTION_PAYLOAD_TOO_LARGE`

**before** our Express code runs. Backend cannot fix that by “raising a limit”.

### Correct flow (required in production)

```
Browser                    Backend                         Cloudinary
   |                          |                                |
   |-- POST /uploads/cloudinary-sign (JSON) -->|               |
   |<-- signature + uploadUrl -----------------|               |
   |                                                           |
   |---------------- POST file (FormData) -------------------->|
   |<---------------- secure_url ------------------------------|
   |                                                           |
   |-- POST /lessons/:id/resources { type, url } -->|          |
   |<-- resource saved -----------------------------|          |
```

### Copy-paste helper

Use [`examples/uploadLessonResource.js`](./examples/uploadLessonResource.js) in the frontend codebase.

```js
import { uploadLessonResource } from './uploadLessonResource';

await uploadLessonResource({
  apiBase: import.meta.env.VITE_API_BASE_URL,
  token,
  lessonId,
  file, // File from <input type="file">
});
```

### Sign endpoint

`POST /uploads/cloudinary-sign`  
Roles: **instructor**, **admin**

```json
{ "type": "pdf", "filename": "notes.pdf", "mimetype": "application/pdf" }
```

`type`: `video` | `pdf` | `zip` | `document` | `image`

Response `data` includes: `uploadUrl`, `apiKey`, `timestamp`, `signature`, `folder`, `public_id`, `resource_type`, `maxBytes`, `formFields`.

Then POST FormData to `uploadUrl` with: `file`, `api_key`, `timestamp`, `signature`, `folder`, `public_id`.

Finally:

```json
POST /lessons/:lessonId/resources
{ "type": "pdf", "url": "https://res.cloudinary.com/.../notes.pdf" }
```

External links only:

```json
{ "type": "link", "url": "https://youtube.com/..." }
```

### Size limits (Cloudinary Free)

| Asset | Max |
|-------|-----|
| Image / PDF / ZIP / document (raw) | **10 MB** |
| Video | **100 MB** |

---

## 4. Paywall & enrollment (product rules)

Content behind `checkEnrollment` requires:

| Actor | Access |
|-------|--------|
| **Admin** | Always |
| **Instructor** | Only if they manage that course |
| **Student** | Enrollment exists **and** `payment.status === "PAID"` |

Important:

- `POST /enrollments` alone does **not** grant paid content access.
- Paid courses must go through **Wafacash**: request → pay cash → submit MTCN + receipt → admin approve → `PAID`.
- Unpaid / guest curriculum may show resource URLs as `"ENROLLMENT_REQUIRED"`.

Payment statuses: `PENDING` → `WAITING_VERIFICATION` → `PAID` | `REJECTED` | `REFUNDED`.

---

## 5. Wafacash student flow

1. **Request payment**  
   `POST /payments/wafacash/request`  
   Body: `{ "courseId": "uuid", "couponCode": "TEST10" }` (coupon optional)  
   → returns `paymentId`, `paymentReference` (e.g. `WFC-XXXXXXXX`), `amount`, and `instructions`.

2. **Student pays at Wafacash** offline using that reference.

3. **Submit proof**  
   `POST /payments/wafacash/submit`  
   `multipart/form-data`:
   - `paymentReference` (string)
   - `mtcn` (10 digits)
   - `receipt` (image file)

   Ownership is enforced: student can only submit for **their** payment.

4. **Admin verifies**  
   `PATCH /payments/wafacash/verify`  
   `{ "paymentId": "uuid", "action": "approve" | "reject", "notes": "..." }`

> Old docs that used `{ status: "PAID" }` are wrong — use `action`.

---

## 6. Authentication

| Method | Path | Auth | Body |
|--------|------|------|------|
| POST | `/auth/register` or `/auth/signup` | No | `{ firstName, lastName, email, password }` — password **≥ 8**; always creates **student** |
| POST | `/auth/login` | No | `{ email, password }` → `{ token, data.user }` |
| GET | `/auth/me` | Yes | Current user |
| POST | `/auth/forgot-password` | No | `{ email }` — always 200 (no email enumeration) |
| POST | `/auth/reset-password/:token` | No | `{ newPassword }` — token valid **5 minutes** |

Auth rate limit: **10 req / minute / IP**.

Store the JWT from login/register. Soft-deleted users cannot log in (`ACCOUNT_DEACTIVATED`).

---

## 7. Full endpoint catalog

Base path: `/api/v1`  
Legend: **JWT** = Bearer required · **Roles** = `restrictTo` · **Paid** = student needs PAID enrollment

### Auth — `/auth`

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| POST | `/register`, `/signup` | | |
| POST | `/login` | | |
| GET | `/me` | ✓ | any |
| POST | `/forgot-password` | | |
| POST | `/reset-password/:token` | | |

### Users — `/users`

| Method | Path | JWT | Roles / notes |
|--------|------|-----|----------------|
| GET/PATCH | `/me` | ✓ | profile |
| PATCH | `/me/password` | ✓ | `{ currentPassword, newPassword }` ≥ 8 |
| DELETE | `/me` | ✓ | soft-delete 204 |
| POST | `/me/avatar` | ✓ | multipart `avatar` |
| GET | `/` | ✓ | **admin** list |
| GET | `/:id` | ✓ | **admin** |

### Courses — `/courses`

| Method | Path | JWT | Roles / notes |
|--------|------|-----|----------------|
| GET | `/search?q=` | | `q` min 2 chars |
| GET | `/` | | public = published only |
| GET | `/:id` | | draft details limited |
| POST | `/` | ✓ | instructor, admin |
| PATCH/PUT | `/:id` | ✓ | instructor, admin |
| DELETE | `/:id` | ✓ | **admin** |
| POST | `/:id/publish` | ✓ | **admin** |
| GET | `/:id/students` | ✓ | instructor, admin |
| GET | `/:id/reviews` | | public |
| POST | `/:id/reviews` | ✓ | PAID student; upsert |

### Curriculum — under `/api/v1`

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| GET | `/courses/:courseId/curriculum` | optional | guests see redacted URLs |
| POST | `/courses/:courseId/sections` | ✓ | instructor, admin |
| PATCH/DELETE | `/sections/:id` | ✓ | instructor, admin |
| POST | `/sections/:sectionId/lessons` | ✓ | instructor, admin |
| PATCH/DELETE | `/lessons/:id` | ✓ | instructor, admin |
| POST | `/lessons/:lessonId/resources` | ✓ | instructor, admin — prefer JSON `{type,url}` |
| DELETE | `/resources/:id` | ✓ | instructor, admin |
| POST | `/uploads/cloudinary-sign` | ✓ | instructor, admin |

### Enrollments — `/enrollments`

| Method | Path | JWT | Notes |
|--------|------|-----|-------|
| GET | `/` | ✓ | my enrollments |
| POST | `/` | ✓ | `{ courseId }` — does not auto-PAID |
| DELETE | `/:id` | ✓ | own only |

### Assignments

| Method | Path | JWT | Notes |
|--------|------|-----|-------|
| POST | `/lessons/:lessonId/assignments` | ✓ | instructor/admin — `{ title, description?, dueDate? }` |
| GET | `/lessons/:lessonId/assignments` | ✓ | **Paid** |
| POST | `/assignments/:id/submissions` | ✓ | **student** + Paid — file or `{ fileUrl }` |
| GET | `/assignments/:id/submissions` | ✓ | instructor, admin |
| PATCH/PUT | `/submissions/:id/grade` | ✓ | `{ grade, feedback? }` |

### Quizzes

| Method | Path | JWT | Notes |
|--------|------|-----|-------|
| GET | `/courses/:courseId/quizzes` | optional | list + lastAttempt if logged in |
| POST | `/lessons/:lessonId/quizzes` | ✓ | instructor/admin `{ title }` |
| POST | `/lessons/:lessonId/quizzes/generate-ai` | ✓ | `{ title, prompt, questionCount? }` — **503** if Groq fails |
| POST | `/quizzes/:quizId/questions` | ✓ | MCQ |
| GET | `/quizzes/:quizId` | ✓ | **Paid**; students don’t get `correctAnswer` |
| PATCH | `/quizzes/:quizId` | ✓ | set `validationStatus: "approved"` to publish |
| DELETE | `/quizzes/:quizId` | ✓ | instructor/admin |
| PATCH/DELETE | `/questions/:questionId` | ✓ | instructor/admin |
| POST | `/quizzes/:quizId/attempts` | ✓ | **student** + Paid; quiz must be **approved**; pass ≥ **60%** |

See [`QUIZ_FRONTEND_GUIDE.md`](./QUIZ_FRONTEND_GUIDE.md) for UI flows.

### Progress & gamification

| Method | Path | JWT | Notes |
|--------|------|-----|-------|
| POST | `/lessons/:lessonId/progress` | ✓ | **Paid** — `{ completed?, videoPosition?, timeSpent? }` |
| GET | `/users/:userId/achievements` | ✓ | owner or admin |

### Notifications

| Method | Path | JWT | Notes |
|--------|------|-----|-------|
| GET | `/users/:userId/notifications` | ✓ | `?unreadOnly=true` |
| PATCH | `/users/:userId/notifications/read-all` | ✓ | |

### Cart / wishlist / coupons

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| GET/DELETE | `/cart` | ✓ | student, admin |
| POST | `/cart/items` | ✓ | `{ courseId }` |
| DELETE | `/cart/items/:itemId` | ✓ | |
| GET | `/wishlist` | ✓ | student, admin |
| POST | `/wishlist` | ✓ | `{ courseId }` |
| DELETE | `/wishlist/:courseId` | ✓ | |
| POST | `/coupons/validate` | ✓ | `{ code, courseId? }` |
| CRUD | `/coupons` | ✓ | **admin** |

### Wafacash — `/payments/wafacash`

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| POST | `/request` | ✓ | student |
| POST | `/submit` | ✓ | student (multipart) |
| GET | `/pending` | ✓ | admin |
| PATCH | `/verify` | ✓ | admin — `{ paymentId, action }` |

### Meetings & instructor analytics

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| GET | `/courses/:courseId/meetings` | ✓ | enrolled PAID / instructor / admin |
| POST | `/courses/:courseId/meetings` | ✓ | instructor, admin |
| GET | `/instructor/analytics/revenue` | ✓ | instructor, admin |
| GET | `/instructor/analytics/students` | ✓ | instructor, admin |
| GET | `/instructor/analytics/completion` | ✓ | instructor, admin |

### Categories

| Method | Path | JWT | Roles |
|--------|------|-----|-------|
| GET | `/categories` | | nested tree |
| POST | `/categories` | ✓ | admin |

### Admin — `/admin/...` (all JWT + **admin**)

| Method | Path | Notes |
|--------|------|-------|
| GET | `/admin/users/pending-kyc` | instructor KYC queue |
| PATCH | `/admin/users/:userId/verify` | `{ isVerified, notes? }` |
| PATCH | `/admin/users/:userId/verify-student` | |
| POST | `/admin/users` | create user |
| PATCH/DELETE | `/admin/users/:userId` | |
| POST/PATCH | `/admin/users/:userId/reset-password` | emails 5-min token |
| PATCH | `/admin/payments/:paymentId/refund` | revokes access |
| GET | `/admin/audit-logs` | |
| GET/POST | `/admin/groups` | |
| PATCH | `/admin/groups/:groupId` | |
| PATCH | `/admin/groups/:groupId/formateur` | |
| POST | `/admin/groups/:groupId/students` | |
| DELETE | `/admin/groups/:groupId/students/:studentId` | |

### Misc

| Method | Path | Notes |
|--------|------|-------|
| GET | `/health` | `{ status, database, requestId }` — **503** if DB down |
| GET | `/api-docs` | often **404 in production** unless `ENABLE_API_DOCS=true` |

---

## 8. Suggested frontend architecture

```
src/
  lib/api.js              # fetch wrapper: base URL, Bearer, parse {success,error}
  lib/uploadLessonResource.js
  auth/                   # login, register, token storage, /auth/me gate
  courses/                # catalog, detail, curriculum
  learn/                  # paywalled player, progress
  payments/wafacash/      # request → instructions → submit receipt
  instructor/             # sections, lessons, cloudinary upload, quizzes
  admin/                  # verify payments, KYC, groups
```

### Fetch wrapper sketch

```js
export async function api(path, { method = 'GET', token, body, formData } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !formData) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}${path}`, {
    method,
    headers,
    body: formData || (body ? JSON.stringify(body) : undefined),
  });

  if (res.status === 204) return null;
  const json = await res.json();
  if (!res.ok || json.success === false) {
    const err = new Error(json?.error?.message || res.statusText);
    err.code = json?.error?.code;
    err.status = res.status;
    throw err;
  }
  return json;
}
```

Handle specially:

| Status / code | UI |
|---------------|-----|
| `401` / `TOKEN_EXPIRED` | logout → login |
| `403` / enrollment | show enroll / pay CTA |
| `413` | you still used multipart to Vercel — switch to Cloudinary-sign |
| `429` `RATE_LIMIT_EXCEEDED` | backoff / toast |
| `503` `SERVICE_UNAVAILABLE` | AI quiz unavailable — retry later |

---

## 9. Roles & screens (mapping)

| Role | Primary screens |
|------|-----------------|
| Visitor | Catalog, course detail, register/login |
| Student | Cart/wishlist, Wafacash pay, classroom, quizzes, assignments, progress |
| Instructor | Course editor, curriculum, Cloudinary uploads, quiz builder, meetings, analytics |
| Admin | Publish courses, verify Wafacash, KYC, refunds, groups, coupons |

---

## 10. Rate limits (production)

| Scope | Limit |
|-------|--------|
| Global | 150 requests / 15 minutes / IP |
| Auth | 10 / minute / IP |

Uses Upstash Redis when configured (shared across Vercel instances).

---

## 11. Health check

```http
GET https://backend-212learn.vercel.app/health
```

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "version": "v1",
    "database": "ok",
    "docs": null,
    "requestId": "...",
    "timestamp": "..."
  }
}
```

Use this in frontend status banners or deploy smoke checks.

---

## 12. What changed recently (read this)

1. **Uploads:** signed Cloudinary flow is mandatory for large files on Vercel.
2. **AI quizzes:** failures return **503**, not fake questions.
3. **Wafacash verify:** body uses `action: "approve"|"reject"`, not `status`.
4. **Wafacash submit:** requires `paymentReference` + `mtcn` + `receipt`; ownership checked.
5. **Assignments:** optional `description` field.
6. **Password:** min **8** characters on register / change / reset.
7. **Reset token:** **5 minutes**.
8. **Unlimited pagination** disabled in production by default.
9. **Cart / wishlist / coupons** are live under `/cart`, `/wishlist`, `/coupons`.

---

## 13. Vercel Web Analytics (frontend)

This backend is API-only. **Install Analytics on the frontend app** (Vite/React or Next), then deploy that site to Vercel.

### 1) Install

```bash
npm i @vercel/analytics
```

### 2) Add the component

**Vite / React (recommended for Lovable / `localhost:5173`):**

```tsx
// App.tsx or main.tsx
import { Analytics } from "@vercel/analytics/react";

export default function App() {
  return (
    <>
      {/* ... your app ... */}
      <Analytics />
    </>
  );
}
```

**Next.js App Router** (only if the frontend is Next):

```tsx
import { Analytics } from "@vercel/analytics/next";

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
```

### 3) Deploy & verify

1. Enable **Web Analytics** in the **frontend** Vercel project settings.
2. Deploy and browse several routes.
3. Within ~30s, page views should appear. If not: disable content blockers and navigate between pages.
4. Network tab should show requests under `/_vercel/insights/`.

Do **not** expect page-view Analytics from `backend-212learn.vercel.app` alone — that host only serves JSON APIs.

---

## 14. Checklist before shipping frontend ↔ backend

- [ ] `VITE_API_BASE_URL` (or equivalent) points to production `/api/v1`
- [ ] JWT stored securely and attached to protected calls
- [ ] Lesson resource upload uses **cloudinary-sign** (not multipart to Vercel)
- [ ] Student paid content gated on `payment.status === "PAID"`
- [ ] Wafacash UI: request → show reference → submit `paymentReference` + `mtcn` + receipt
- [ ] Quiz publish uses `validationStatus: "approved"`; attempts only then
- [ ] AI quiz generation handles **503**
- [ ] Frontend origin is allowlisted (CORS) / `FRONTEND_URL` set on Vercel
- [ ] `@vercel/analytics` installed on **frontend** and deployed
- [ ] Errors mapped via `error.code` ([`ERROR_CODES.md`](./ERROR_CODES.md))

---

## 15. Contact / support for backend issues

When reporting a bug, include:

1. Exact path + method  
2. `requestId` if present  
3. Status + `error.code`  
4. Role + whether enrollment is PAID  
5. Timestamp (UTC)

Smoke against production:

```bash
curl -s https://backend-212learn.vercel.app/health
```
