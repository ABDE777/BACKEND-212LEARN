import prisma from '../config/prisma.js';
import { successResponse } from '../utils/response.js';

// GET /api/v1/diagnostics  &  GET /api/v1/admin/diagnostics
export const getDiagnostics = async (req, res, next) => {
  try {
    const startTime = Date.now();

    // 1. Measure DB ping & fetch row counts in parallel
    const [
      dbPing,
      userCount,
      courseCount,
      enrollmentCount,
      paymentCount,
      auditLogCount,
      categoryCount,
    ] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.user.count(),
      prisma.course.count(),
      prisma.enrollment.count(),
      prisma.payment.count(),
      prisma.auditLog.count(),
      prisma.category.count(),
    ]);

    const dbLatencyMs = Date.now() - startTime;

    // 2. Gather system metrics
    const memoryUsage = process.memoryUsage();
    const uptimeSeconds = Math.floor(process.uptime());

    const diagnosticsData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: {
        status: 'connected',
        latencyMs: dbLatencyMs,
        counts: {
          users: userCount,
          courses: courseCount,
          enrollments: enrollmentCount,
          payments: paymentCount,
          auditLogs: auditLogCount,
          categories: categoryCount,
        },
      },
      system: {
        nodeVersion: process.version,
        environment: process.env.NODE_ENV || 'development',
        uptimeSeconds,
        memoryUsage: {
          heapUsedMb: Number((memoryUsage.heapUsed / 1024 / 1024).toFixed(2)),
          heapTotalMb: Number((memoryUsage.heapTotal / 1024 / 1024).toFixed(2)),
          rssMb: Number((memoryUsage.rss / 1024 / 1024).toFixed(2)),
        },
      },
    };

    res.status(200).json(successResponse(diagnosticsData));
  } catch (error) {
    next(error);
  }
};
