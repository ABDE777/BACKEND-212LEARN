import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { getJwtSecret } from '../config/jwt.js';
import { getAppSettings } from '../utils/settings.js';
import { errorResponse } from '../utils/response.js';

// Paths that must keep working while maintenance mode is ON, so admins can log
// in and turn it back off. Everything under these prefixes is always allowed.
const ALLOW_PREFIXES = ['/auth', '/admin'];

/**
 * When `maintenanceMode` is enabled, block non-admin API traffic with 503.
 * Admins (resolved softly from their JWT) and the auth/admin endpoints stay
 * available so the platform can be brought back up. Mounted under /api/v1, so
 * the /health check (outside /api/v1) is never affected.
 */
export const maintenanceGate = async (req, res, next) => {
  try {
    const settings = await getAppSettings();
    if (!settings.maintenanceMode) return next();

    // Always allow the auth + admin surfaces (still guarded by their own auth).
    if (ALLOW_PREFIXES.some((p) => req.path === p || req.path.startsWith(`${p}/`))) {
      return next();
    }

    // Soft-resolve the caller; admins bypass maintenance.
    const auth = req.headers.authorization;
    if (auth && auth.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(auth.split(' ')[1], getJwtSecret());
        const user = await prisma.user.findUnique({
          where: { id: decoded.id },
          select: { role: true },
        });
        if (user?.role === 'admin') return next();
      } catch {
        // fall through to 503
      }
    }

    return res.status(503).json(
      errorResponse('The platform is under maintenance. Please try again later.', 'MAINTENANCE_MODE')
    );
  } catch {
    // Never let the gate itself take the site down.
    return next();
  }
};
