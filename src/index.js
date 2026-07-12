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

dotenv.config();

const app  = express();
const PORT = process.env.PORT || 5000;

// ── API version prefix ────────────────────────────────────────────────────────
const V1 = '/api/v1';

// ── Security & utility middlewares ────────────────────────────────────────────
app.use(helmet({ contentSecurityPolicy: false })); // CSP disabled so Swagger UI renders
app.use(cors());
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
app.use(`${V1}/courses`,     courseRoutes);
app.use(`${V1}/enrollments`, enrollmentRoutes);

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
  console.log(`📋 [v1]      ${V1}/auth | ${V1}/users | ${V1}/courses | ${V1}/enrollments`);
});
