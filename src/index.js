import express from 'express';
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
import wafacashRoutes from './routes/wafacash.routes.js';
import progressRoutes from './routes/progress.routes.js';
import quizRoutes     from './routes/quiz.routes.js';
import reviewRoutes    from './routes/review.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── API version prefix ────────────────────────────────────────────────────────
const V1 = '/api/v1';

// ── Security & utility middlewares ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled so Swagger UI renders
const allowedOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:5175',
  'https://backend-212learn.vercel.app',
  'https://212-learn.vercel.app',
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

app.use(express.json());
app.use(process.env.NODE_ENV === 'development' ? morgan('dev') : morgan('combined'));

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: '212Learning API Docs',
    customCss: '.swagger-ui .topbar { background-color: #0d1117; }',
    swaggerOptions: { persistAuthorization: true },
  })
);

// Raw OpenAPI JSON — import into Postman / Insomnia
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json(successResponse({
    status:    'healthy',
    version:   'v1',
    docs:      `http://localhost:${PORT}/api-docs`,
    timestamp: new Date().toISOString(),
  }));
});

// ── Diagnostics (DB connectivity) ────────────────────────────────────────────
app.get(`${V1}/diagnostics`, async (req, res, next) => {
  try {
    const [userCount, courseCount, enrollmentCount] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
    ]);
    res.status(200).json(successResponse({ databaseConnected: true, userCount, courseCount, enrollmentCount }));
  } catch (error) {
    next(error);
  }
});

// ── API v1 Routes ─────────────────────────────────────────────────────────────
app.use(`${V1}/auth`,        authRoutes);
app.use(`${V1}/users`,       userRoutes);
app.use(`${V1}`,             sectionRoutes);    // /courses/:id/curriculum, /sections/:id, /lessons/:id
app.use(`${V1}`,             resourceRoutes);   // /lessons/:id/resources, /resources/:id
app.use(`${V1}`,             assignmentRoutes); // /lessons/:id/assignments, /submissions/:id/grade
app.use(`${V1}/courses`,     courseRoutes);
app.use(`${V1}/enrollments`, enrollmentRoutes);
app.use(`${V1}/categories`,  categoryRoutes);
app.use(`${V1}/payments/wafacash`, wafacashRoutes);
app.use(`${V1}`,             progressRoutes); // /courses/:id/quizzes, /lessons/:id/progress, /users/:id/achievements
app.use(`${V1}`,             quizRoutes);     // /lessons/:id/quizzes, /quizzes/:id, /quizzes/:id/attempts
app.use(`${V1}`,             reviewRoutes);   // /courses/:id/reviews, /users/:id/notifications
app.use(`${V1}`,             analyticsRoutes); // /instructor/analytics/*, /courses/:id/meetings

// ── 404 ───────────────────────────────────────────────────────────────────────
app.all('*', (req, res, next) => {
  next(new AppError(`Route ${req.originalUrl} not found. See /api-docs.`, 404, 'NOT_FOUND'));
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡ [server]  http://localhost:${PORT}`);
  console.log(`📚 [docs]    http://localhost:${PORT}/api-docs`);
  console.log(`📋 [v1]      ${V1}/auth | ${V1}/users | ${V1}/courses | ${V1}/enrollments | ${V1}/categories`);
  console.log(`📋 [v1]      ${V1}/(courses|sections|lessons) | ${V1}/(lessons|resources) | ${V1}/(lessons|assignments|submissions)`);
});
