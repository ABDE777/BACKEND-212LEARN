# 212LEARN Backend API

Production REST API for the **212LEARN** e-learning platform.

| | |
|---|---|
| **Production** | https://backend-212learn.vercel.app |
| **API base** | https://backend-212learn.vercel.app/api/v1 |
| **Health** | https://backend-212learn.vercel.app/health |
| **Stack** | Node.js · Express · Prisma 7 · PostgreSQL (Neon) · Cloudinary · Groq · Upstash Redis |

> **Frontend developers:** start with [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md) — full integration guide, upload flow, paywall rules, endpoint catalog, and Vercel Analytics setup.

---

## Features

- JWT auth + RBAC (`student` / `instructor` / `admin`)
- Courses → sections → lessons → resources / assignments / quizzes
- Wafacash cash payments (PENDING → WAITING_VERIFICATION → PAID / REJECTED / REFUNDED)
- Enrollment paywall (`PAID` required for curriculum content)
- Cart, wishlist, coupons
- AI quiz generation (Groq) — returns **503** if AI is unavailable (no silent mock)
- Direct Cloudinary uploads (avoids Vercel **413** body limit)
- Rate limiting (memory + optional Upstash Redis)
- CI: Prisma validate + unit tests

---

## Environment variables

### Required (production)

```env
NODE_ENV=production
DATABASE_URL=postgresql://...          # Neon (pooled URL recommended on Vercel)
JWT_SECRET=long-random-secret          # required in production
JWT_EXPIRES_IN=7d

CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

FRONTEND_URL=https://your-frontend.vercel.app
GROQ_API_KEY=...                       # AI quizzes
```

### Recommended (production)

```env
# Distributed rate limits across Vercel instances
UPSTASH_REDIS_REST_URL=https://....upstash.io
UPSTASH_REDIS_REST_TOKEN=...

# Optional
ENABLE_API_DOCS=true                   # expose /api-docs in production
ALLOW_UNLIMITED_PAGINATION=false       # keep false in prod
WAFACASH_AUTO_APPROVE=false
PG_POOL_MAX=1                          # Neon serverless (defaulted when VERCEL=1)
```

### Email (password reset)

```env
EMAIL_MOCK=false
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=...
EMAIL_PASS=...
EMAIL_FROM="212Learn" <noreply@example.com>
```

**Never commit `.env`.** Rotate any secrets that were shared in chat.

---

## Local development

```bash
npm install
cp .env.example .env   # if present; otherwise create .env from the list above
npm run db:setup       # generate + migrate deploy + lean seed
npm run dev            # http://localhost:5000
```

### Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Nodemon local server |
| `npm start` | Production start |
| `npm run db:setup` | Prisma generate + migrate deploy + seed |
| `npm run prisma:seed` | Lean test dataset only |
| `npm test` | Unit tests |

### Seed accounts (password: `password123`)

| Email | Role | Notes |
|-------|------|--------|
| `admin@212learn.com` | admin | Full access |
| `instructor@212learn.com` | instructor | Course manager |
| `student1@212learn.com` | student | **PAID** on React Essentials |
| `student2@212learn.com` | student | **PENDING** Wafacash `WFC-TESTPEND` |

Coupon: `TEST10` (10%). Courses: React Essentials, JavaScript Basics.

---

## Uploads (important)

Vercel serverless rejects request bodies larger than **~4.5 MB** (`413 FUNCTION_PAYLOAD_TOO_LARGE`).

**Do not** `multipart` large PDFs/videos to `/lessons/:id/resources` on production.

**Correct flow:**

1. `POST /api/v1/uploads/cloudinary-sign` (JSON)
2. Browser uploads file **directly to Cloudinary**
3. `POST /api/v1/lessons/:id/resources` with JSON `{ type, url }`

Helper for the frontend: [`examples/uploadLessonResource.js`](./examples/uploadLessonResource.js)

Cloudinary Free limits: **image/raw 10 MB**, **video 100 MB**.

---

## Docs for the team

| Document | Audience |
|----------|----------|
| [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md) | Frontend — send this |
| [`FRONTEND_API_GUIDE.md`](./FRONTEND_API_GUIDE.md) | Detailed request/response examples |
| [`QUIZ_FRONTEND_GUIDE.md`](./QUIZ_FRONTEND_GUIDE.md) | Quiz builder + player |
| [`ERROR_CODES.md`](./ERROR_CODES.md) | Error code reference |

Swagger UI: `/api-docs` (off in production unless `ENABLE_API_DOCS=true`).

---

## Vercel Analytics

This repo is an **API-only** Express app. Page-view Analytics must be installed on the **frontend** project (Vite/React or Next), not here.

Exact steps for the frontend team are in [`FRONTEND_TEAM_HANDOFF.md`](./FRONTEND_TEAM_HANDOFF.md#vercel-web-analytics-frontend).

---

## Testing

```bash
npm test                 # unit (CI)
npm run test:integration # needs local server
```

---

## Deployment

- Host: **Vercel** → https://backend-212learn.vercel.app  
- Region note: function often runs near `cdg1` (Paris); Neon may be US — expect occasional cold DB latency.  
- Ensure all env vars above are set in the Vercel project (including Upstash).  
- Redeploy after env changes.
