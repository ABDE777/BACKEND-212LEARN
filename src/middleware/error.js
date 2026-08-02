import { errorResponse } from '../utils/response.js';

export class AppError extends Error {
  constructor(message, statusCode, code = 'APP_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // ── Prisma: unique constraint (P2002) ────────────────────────────────────
  if (err.code === 'P2002') {
    const fields = err.meta?.target || [];
    return res.status(409).json(
      errorResponse(
        `Value already exists for: ${fields.join(', ')}.`,
        'DUPLICATE_VALUE'
      )
    );
  }

  // ── Prisma: record not found (P2025) ─────────────────────────────────────
  if (err.code === 'P2025') {
    return res.status(404).json(
      errorResponse(err.meta?.cause || 'Record not found.', 'NOT_FOUND')
    );
  }

  // ── JWT errors ────────────────────────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(errorResponse('Invalid token.', 'INVALID_TOKEN'));
  }
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(errorResponse('Token expired.', 'TOKEN_EXPIRED'));
  }

  // ── Multer / upload size errors ───────────────────────────────────────────
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json(
      errorResponse('File too large for Cloudinary limits.', 'VALIDATION_ERROR')
    );
  }
  if (err.message && /File too large|Unsupported file type/i.test(err.message)) {
    return res.status(400).json(errorResponse(err.message, 'VALIDATION_ERROR'));
  }

  // ── Operational errors (thrown by AppError) ───────────────────────────────
  const body = errorResponse(err.message || 'Internal Server Error', err.code || 'INTERNAL_ERROR');

  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
