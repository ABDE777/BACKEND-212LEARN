# 212Learn — Performance & Scalability Plan

Written as an engineering proposal. It explains **why the app feels slow today
(with only a handful of users)**, then a **prioritized roadmap** from quick wins
to the architecture needed for thousands → millions of users.

---

## 1. Why it's slow right now (with 4–6 users)

The data volume is irrelevant at this scale — 6 rows return in <1 ms in Postgres.
The latency is **structural**, from the current stack (React SPA on Vercel →
Express on Vercel **serverless** → Prisma → **Neon** Postgres):

1. **Neon autosuspend.** On the free/launch tier Neon **suspends the database
   after ~5 min of inactivity**. The next query has to *wake* it (~0.5–3 s). The
   first action after a pause always feels frozen.
2. **Serverless cold starts.** Each Vercel function that hasn't run recently
   cold-boots Node + initializes Prisma + opens a Neon connection before it can
   answer. That's hundreds of ms *per cold endpoint*.
3. **Request waterfalls.** The dashboards fan out into many calls on a single
   page load. The admin dashboard alone fires ~8–10 requests:
   `GET /users` (×2), `/admin/users/pending-kyc`, `/users?role=instructor`,
   `/courses`, `/courses?status=draft`, `/enrollments?limit=500`,
   `/admin/stats`, groups… Every one can independently hit a cold function and a
   sleeping DB. **N cold starts instead of 1.**
4. **Over-fetching.** `GET /enrollments?limit=500` and `limit=200` user pulls
   fetch far more than a first screen needs, and re-fetch on every visit.

> **Diagnosis:** the bottleneck is **round-trips × cold starts**, not SQL.
> Fixing that is mostly about *fewer, warmer, cached* requests — not faster queries.

---

## 2. Quick wins (days — do these first)

These give the biggest felt improvement for the least risk.

- **Keep the database warm.** Turn **off Neon autosuspend** (paid) *or* add a
  tiny cron (Vercel Cron / GitHub Action) hitting `/health` every 3–4 min so the
  DB and a function stay warm. Removes the worst "first click is frozen" stall.
- **Collapse dashboard waterfalls into one call.** Add per-role *bootstrap*
  endpoints that return everything a dashboard needs in a single response, e.g.
  `GET /admin/overview` → `{ stats, recentUsers, pendingKyc, courses }`. One
  cold start instead of eight. (Pattern already proven by `/api/v1/ai/overview`.)
- **Stop over-fetching.** Paginate hard (`limit=20`) and never ship
  `?limit=500`. Load the first page; fetch more on demand.
- **HTTP caching on public GETs.** Add `Cache-Control: public, max-age=60,
  stale-while-revalidate=300` to catalog/course/category/stats responses so
  Vercel's CDN serves repeats without touching a function or the DB. (The
  sitemap already does this.)
- **A few composite indexes** for the hottest filters (see §6).
- **Client cache.** The axios layer already has a 15 s GET cache; raise the TTL
  for slow-changing data (categories, published catalog) and cache per-URL
  instead of clearing everything on any write.

Expected result: dashboards that feel instant on warm hits, and one short
warm-up instead of many.

---

## 3. Mid-term (weeks — for steady growth to ~10–100k users)

- **Move the API off per-request serverless to an always-warm runtime.** The
  single highest-leverage change. Run Express as a long-lived service on
  **Render / Railway / Fly.io** (or Vercel + `fluid`/provisioned concurrency).
  No cold starts, a real reusable connection pool, and predictable latency.
- **Connection pooling done right.** Keep using the **Neon pooler** endpoint
  (`-pooler`, already in the URL). On an always-on server, raise `PG_POOL_MAX`
  to ~10–20; on serverless keep `max: 1` (already the case) and rely on the
  pooler/PgBouncer to fan in.
- **Redis cache layer** (Upstash) for hot reads: catalog pages, course details,
  stats, session/rate-limit state. Cache-aside with short TTLs + explicit
  invalidation on writes.
- **Background jobs / queue** (BullMQ on Redis, or Neon + a worker) for
  anything slow or bursty: sending emails, generating certificates/invoices,
  processing recordings, notifications — so requests return immediately.
- **Kill remaining N+1s.** Audit controllers for per-row queries in loops
  (e.g. per-course progress counts); replace with `groupBy`/joined aggregates.
- **Ship `select`, not `include`-everything.** Return only fields the UI uses;
  trims payloads and DB work.
- **Observability.** Add request timing + slow-query logging (or a tool like
  Sentry/Logtail) so decisions are data-driven, not guesses.

---

## 4. Scaling to hundreds of thousands → millions

- **Stateless API + horizontal autoscaling** behind a load balancer. Nothing in
  a request may rely on local memory (move the in-memory GET/settings caches and
  rate-limiter to Redis so every instance shares them).
- **Postgres read replicas.** Route read-heavy traffic (catalog, course pages,
  analytics) to replicas; keep writes on the primary. Neon supports read
  replicas; Prisma can target them.
- **CDN everything static + cacheable.** The SPA and all public JSON (catalog,
  course, `ai/overview`, sitemap) served from the edge; the DB only handles
  personalized/uncacheable traffic.
- **Media & recordings off the app path.** Videos, thumbnails, recordings, PDFs
  on object storage + CDN (Cloudinary is already used for uploads) — never
  streamed through the API.
- **Search** (catalog) → a dedicated engine (Postgres full-text/`pg_trgm` first,
  then Meilisearch/Typesense/OpenSearch) instead of `LIKE` scans.
- **Rate limiting & abuse protection** at the edge (Vercel/Cloudflare) before
  requests reach Node.
- **DB partitioning/archival** for high-volume tables (audit logs, lesson
  progress, notifications) once they reach tens of millions of rows.
- **Load-test before you need it** (k6/Artillery) so limits are known in advance.

---

## 5. Recommended path (concrete order)

1. Warm the DB (cron on `/health`) + add `Cache-Control` to public GETs. *(hours)*
2. Add `/admin/overview`, `/student/overview`, `/instructor/overview` bootstrap
   endpoints; cut dashboard calls from ~10 → 1 each. *(days)*
3. Hard pagination + drop `limit=500`/`200` fetches. *(days)*
4. Add the composite indexes in §6. *(hours)*
5. Move the API to an always-on host (Render/Railway/Fly). *(days)*
6. Introduce Redis (Upstash) for hot caches + rate limiting. *(week)*
7. Background queue for email/certificates/recordings. *(week)*
8. Read replicas + edge caching when traffic warrants. *(later)*

Steps 1–4 alone should make it feel fast today; 5–6 remove the ceiling for the
first serious growth; 7–8 are the "millions" tier.

---

## 6. Index quick wins (safe, high-value)

The schema already indexes the main foreign keys and status columns. The
hottest *missing* composites, based on the admin/user queries:

- `users (role, deletedAt)` — admin stats & user listings filter by both.
- `users (deletedAt)` — "active users" everywhere.
- `payments (provider, status)` already exists; keep.

A migration adding the `users` composites ships alongside this doc.
