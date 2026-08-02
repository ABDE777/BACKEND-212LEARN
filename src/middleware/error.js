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
    return res.status(413).json(
      errorResponse(
        'File exceeds Vercel’s 4.5 MB API limit. Use POST /api/v1/uploads/cloudinary-sign, upload to Cloudinary, then POST { type, url } to /resources.',
        'PAYLOAD_TOO_LARGE'
      )
    );
  }
  if (err.message && /File too large|Unsupported file type|Vercel|cloudinary-sign/i.test(err.message)) {
    const code = /Vercel|4\.5 MB|PAYLOAD/i.test(err.message) ? 413 : 400;
    return res.status(code).json(
      errorResponse(err.message, code === 413 ? 'PAYLOAD_TOO_LARGE' : 'VALIDATION_ERROR')
    );
  }

  // ── Operational errors (thrown by AppError) ───────────────────────────────
  const body = errorResponse(err.message || 'Internal Server Error', err.code || 'INTERNAL_ERROR');

  if (process.env.NODE_ENV === 'development') {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};
