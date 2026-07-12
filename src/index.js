import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.js';
import { errorHandler } from './middleware/error.js';
import prisma from './config/prisma.js';

// Route modules
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import courseRoutes from './routes/course.routes.js';
import enrollmentRoutes from './routes/enrollment.routes.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ── API version prefix ────────────────────────────────────────────────────────
const API_V1 = '/api/v1';

// ── Security & utility middlewares ────────────────────────────────────────────
app.use(
  helmet({
    contentSecurityPolicy: false, // Disable CSP so Swagger UI loads correctly
  })
);
app.use(cors());
app.use(express.json());

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ── Swagger UI ────────────────────────────────────────────────────────────────
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customSiteTitle: '212Learning API Docs',
    customCss: '.swagger-ui .topbar { background-color: #0d1117; }',
    swaggerOptions: {
      persistAuthorization: true, // Remember JWT token across page refreshes
    },
  })
);

// Expose raw OpenAPI JSON (useful for Postman import)
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: '212Learning Backend is active',
    version: 'v1',
    docs: `http://localhost:${PORT}/api-docs`,
    timestamp: new Date().toISOString(),
  });
});

// ── Database diagnostics ──────────────────────────────────────────────────────
app.get(`${API_V1}/diagnostics`, async (req, res, next) => {
  try {
    const [userCount, courseCount, enrollmentCount] = await Promise.all([
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
    ]);
    res.status(200).json({
      status: 'success',
      data: { databaseConnected: true, userCount, courseCount, enrollmentCount },
    });
  } catch (error) {
    next(error);
  }
});

// ── API v1 Routes ─────────────────────────────────────────────────────────────
app.use(`${API_V1}/auth`, authRoutes);
app.use(`${API_V1}/users`, userRoutes);
app.use(`${API_V1}/courses`, courseRoutes);
app.use(`${API_V1}/enrollments`, enrollmentRoutes);

// ── 404 fallback ──────────────────────────────────────────────────────────────
app.all('*', (req, res) => {
  res.status(404).json({
    status: 'fail',
    message: `Route ${req.originalUrl} not found. Visit /api-docs for documentation.`,
  });
});

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`⚡ [server]:  http://localhost:${PORT}`);
  console.log(`📚 [docs]:    http://localhost:${PORT}/api-docs`);
  console.log(`📋 [routes]:  ${API_V1}/auth | ${API_V1}/users | ${API_V1}/courses | ${API_V1}/enrollments`);
});
