import express from 'express'; // reload server with security middlewares
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import { errorHandler, AppError } from './middleware/error.js';
import { successResponse } from './utils/response.js';
import prisma from './config/prisma.js';

// Route modules (v1)
import authRoutes       from './routes/auth.routes.js';
import userRoutes       from './routes/user.routes.js';
import courseRoutes     from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';
import categoryRoutes   from './routes/category.routes.js';
import sectionRoutes    from './routes/section.routes.js';
import resourceRoutes   from './routes/resource.routes.js';
import assignmentRoutes from './routes/assignment.routes.js';
import uploadRoutes     from './routes/upload.routes.js';
import wafacashRoutes from './routes/wafacash.routes.js';
import transferRoutes  from './routes/transfer.routes.js';
import progressRoutes from './routes/progress.routes.js';
import quizRoutes     from './routes/quiz.routes.js';
import reviewRoutes    from './routes/review.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import adminRoutes     from './routes/admin.routes.js';
import cartRoutes      from './routes/cart.routes.js';
import wishlistRoutes  from './routes/wishlist.routes.js';
import couponRoutes    from './routes/coupon.routes.js';
import meetingRoutes   from './routes/meeting.routes.js';
import statsRoutes     from './routes/stats.routes.js';
import groupRoutes     from './routes/group.routes.js';
import groupChatRoutes from './routes/groupChat.routes.js';
import courseUpdateRequestRoutes from './routes/courseUpdateRequest.routes.js';
import aiRoutes        from './routes/ai.routes.js';
import contactRoutes   from './routes/contact.routes.js';
import { getAiPluginManifest, getSitemap } from './controllers/ai.controller.js';
import { xssSanitizer, preventParameterPollution, rateLimiter } from './middleware/security.js';
import { requestId, accessLogger } from './middleware/requestId.js';
import { validateJwtSecret } from './config/jwt.js';
import { startCleanupService } from './services/cleanup.service.js';

dotenv.config();

// ── Security validations on startup ─────────────────────────────────────────────
try {
  validateJwtSecret();
} catch (error) {
  console.error('FATAL: Security validation failed:', error.message);
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 5000;

// Trust exactly one hop (Vercel's edge / the platform's reverse proxy).
// This makes Express recompute req.ip from X-Forwarded-For itself, taking the
// address the proxy appended rather than whatever a client puts in the header —
// required so rate limiting can't be bypassed by spoofing X-Forwarded-For.
app.set('trust proxy', 1);

// ── API version prefix ────────────────────────────────────────────────────────
const V1 = '/api/v1';

// ── Security & utility middlewares ────────────────────────────────────────────
app.use(requestId);
app.use(accessLogger);
// Content-Security-Policy tuned to keep Swagger UI working (it injects inline
// styles/scripts) while still constraining the API's HTML surface: no framing
// (clickjacking), no plugins, and connections/images limited to self + data URIs.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      baseUri: ["'self'"],
    },
  },
}));
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://backend-212learn.vercel.app',
  'http://localhost:8081',
  'https://212-learn.vercel.app',
  'https://212-learn-frontend.vercel.app',
  'https://learn212.lovable.app',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      } else {
        return callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(process.env.NODE_ENV === 'development' ? morgan('dev') : morgan('combined'));

// ── Security Hardening Middlewares ───────────────────────────────────────────
app.use(preventParameterPollution); // Protect against HTTP Parameter Pollution
app.use(xssSanitizer);              // Sanitize input body/query/params from XSS scripts
app.use(rateLimiter(900000, 150, 'Too many requests from this IP. Please try again later.', { prefix: 'global' }));

// ── Public Routes (no auth required) ───────────────────────────────────────────
// Mounted AFTER the security block so these unauthenticated DB-backed endpoints
// still get HPP protection, input sanitizing, and the global rate limiter.
app.use(`${V1}/stats`, statsRoutes);

const docsEnabled =
  process.env.ENABLE_API_DOCS === 'true' ||
  process.env.NODE_ENV !== 'production';

if (docsEnabled) {
  app.use(
    '/api-docs',
    swaggerUi.serve,
    swaggerUi.setup(swaggerSpec, {
      customSiteTitle: '212Learning API Docs',
      customCss: '.swagger-ui .topbar { background-color: #0d1117; }',
      swaggerOptions: { persistAuthorization: true },
    })
  );

  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
} else {
  app.use('/api-docs', (req, res, next) => {
    next(new AppError('API docs are disabled in production.', 404, 'NOT_FOUND'));
  });
  app.get('/api-docs.json', (req, res, next) => {
    next(new AppError('API docs are disabled in production.', 404, 'NOT_FOUND'));
  });
}

// ── AI plugin manifest (agent discovery) — public, at the well-known path ────
app.get('/.well-known/ai-plugin.json', getAiPluginManifest);

// ── Dynamic sitemap (core pages + every published course) — public ───────────
app.get('/sitemap.xml', getSitemap);

// ── Health check (includes DB ping) ───────────────────────────────────────────
app.get('/health', async (req, res) => {
  const host = req.get('host') || `localhost:${PORT}`;
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const docsEnabled =
    process.env.ENABLE_API_DOCS === 'true' ||
    process.env.NODE_ENV !== 'production';

  let database = 'ok';
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    database = 'error';
  }

  const healthy = database === 'ok';
  res.status(healthy ? 200 : 503).json(successResponse({
    status:    healthy ? 'healthy' : 'degraded',
    version:   'v1',
    database,
    docs:      docsEnabled ? `${protocol}://${host}/api-docs` : null,
    requestId: req.requestId,
    timestamp: new Date().toISOString(),
  }));
});

// ── Diagnostics (System & DB Health) ───────────────────────────────────────────
import { getDiagnostics } from './controllers/diagnostics.controller.js';
import { protect, restrictTo } from './middleware/auth.js';
import { maintenanceGate } from './middleware/maintenance.js';

app.get(`${V1}/diagnostics`, protect, restrictTo('admin'), getDiagnostics);
app.get(`${V1}/admin/diagnostics`, protect, restrictTo('admin'), getDiagnostics);

// Maintenance gate: when enabled in settings, blocks non-admin API traffic
// (503) while keeping /auth and /admin available so admins can recover.
app.use(`${V1}`, maintenanceGate);

// ── API v1 Routes ─────────────────────────────────────────────────────────────
app.use(`${V1}/auth`,        authRoutes);
app.use(`${V1}/users`,       userRoutes);
app.use(`${V1}`,             sectionRoutes);    // /courses/:id/curriculum, /sections/:id, /lessons/:id
app.use(`${V1}`,             resourceRoutes);   // /lessons/:id/resources, /resources/:id
app.use(`${V1}/uploads`,     uploadRoutes);     // /uploads/cloudinary-sign
app.use(`${V1}`,             assignmentRoutes); // /lessons/:id/assignments, /submissions/:id/grade
app.use(`${V1}/courses`,     courseRoutes);
app.use(`${V1}/enrollments`, enrollmentRoutes);
app.use(`${V1}/categories`,  categoryRoutes);
app.use(`${V1}/payments/wafacash`, wafacashRoutes);
app.use(`${V1}/payments/transfer`, transferRoutes);
app.use(`${V1}/cart`,        cartRoutes);
app.use(`${V1}/wishlist`,    wishlistRoutes);
app.use(`${V1}/coupons`,     couponRoutes);
app.use(`${V1}/groups`,      groupRoutes);
app.use(`${V1}/groups`,      groupChatRoutes);
app.use(`${V1}`,             progressRoutes); // /courses/:id/quizzes, /lessons/:id/progress, /users/:id/achievements
app.use(`${V1}`,             quizRoutes);     // /lessons/:id/quizzes, /quizzes/:id, /quizzes/:id/attempts
app.use(`${V1}`,             reviewRoutes);   // /courses/:id/reviews, /users/:id/notifications
app.use(`${V1}`,             analyticsRoutes); // /instructor/analytics/*
app.use(`${V1}/ai`,          aiRoutes);        // /ai/overview (machine-readable)
app.use(`${V1}/contact`,     contactRoutes);   // /contact
app.use(`${V1}`,             meetingRoutes);   // /courses/:id/meetings, /meetings/*
// Mount BEFORE adminRoutes: adminRoutes applies a blanket restrictTo('admin') to
// its whole router, so any unmatched /api/v1/* request that reaches it is 403'd.
// The instructor update-request routes must match first, with their own guards.
app.use(`${V1}`,             courseUpdateRequestRoutes); // /courses/:id/update-requests, /instructor/update-requests, /admin/update-requests
app.use(`${V1}`,             adminRoutes);     // /admin/*

// ── 404 ───────────────────────────────────────────────────────────────────────
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found. See /api-docs.`, 404, 'NOT_FOUND'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server (skip on Vercel — platform invokes the exported app) ─────────
const isVercel = Boolean(process.env.VERCEL);

if (!isVercel) {
  app.listen(PORT, () => {
    console.log(`⚡ [server]  http://localhost:${PORT}`);
    console.log(`📚 [docs]    http://localhost:${PORT}/api-docs`);
    console.log(`📋 [v1]      ${V1}/auth | ${V1}/users | ${V1}/courses | ${V1}/enrollments | ${V1}/categories`);
    console.log(`📋 [v1]      ${V1}/(courses|sections|lessons) | ${V1}/(lessons|resources) | ${V1}/(lessons|assignments|submissions)`);
    
    // Start cleanup service for scheduled tasks
    startCleanupService();
  });
}

export default app;
