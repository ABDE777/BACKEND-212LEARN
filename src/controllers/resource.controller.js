import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import {
  cloudinary,
  uploadFileToCloudinary,
  publicIdFromCloudinaryUrl,
  maxBytesForMimetype,
} from '../config/cloudinary.js';
import { ensureCourseManager } from '../utils/authorization.js';
import { validateUUID, validateURL } from '../utils/validation.js';
import fs from 'fs/promises';

const ALLOWED_TYPES = ['video', 'pdf', 'zip', 'document', 'image', 'link'];

/** Prevent double-submit: concurrent identical uploads share one in-flight promise. */
const inFlightUploads = new Map();

async function unlinkQuietly(filePath) {
  if (!filePath) return;
  try {
    await fs.unlink(filePath);
  } catch {
    // ignore
  }
}

function typeFromMimetype(mimetype) {
  if (mimetype.startsWith('video/')) return 'video';
  if (mimetype === 'application/pdf') return 'pdf';
  if (mimetype.includes('zip')) return 'zip';
  if (
    mimetype === 'application/msword' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  if (mimetype.startsWith('image/')) return 'image';
  return null;
}

function uploadDedupeKey(userId, lessonId, file) {
  return [
    userId,
    lessonId,
    file.originalname || '',
    file.size || 0,
    file.mimetype || '',
  ].join('::');
}

async function createFileResource({ lessonId, type, file }) {
  const max = maxBytesForMimetype(file.mimetype);
  if (file.size > max) {
    await unlinkQuietly(file.path);
    const mb = Math.round(max / (1024 * 1024));
    throw new AppError(
      `File too large. Max for this type is ${mb} MB (Cloudinary limit).`,
      400,
      'VALIDATION_ERROR'
    );
  }

  const result = await uploadFileToCloudinary(file);
  const resolvedType = type || typeFromMimetype(file.mimetype);

  if (!resolvedType || !ALLOWED_TYPES.includes(resolvedType)) {
    throw new AppError(`type must be one of: ${ALLOWED_TYPES.join(', ')}.`, 400, 'VALIDATION_ERROR');
  }

  const existing = await prisma.resource.findFirst({
    where: { lessonId, url: result.secure_url },
  });
  if (existing) return existing;

  return prisma.resource.create({
    data: {
      lessonId,
      type: resolvedType,
      url: result.secure_url,
    },
  });
}

// ─── POST /lessons/:lessonId/resources ───────────────────────────────────────
export const addResource = async (req, res, next) => {
  try {
    validateUUID(req.params.lessonId, 'lessonId');

    const lesson = await prisma.lesson.findUnique({
      where: { id: req.params.lessonId },
      include: { section: true },
    });

    if (!lesson) {
      return next(new AppError('Lesson not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, lesson.section.courseId);

    let { type, url } = req.body;
    let resource;

    if (req.file) {
      const key = uploadDedupeKey(req.user.id, req.params.lessonId, req.file);

      // Second request for the same file (double-click / Strict Mode) reuses first result
      if (inFlightUploads.has(key)) {
        await unlinkQuietly(req.file.path);
        resource = await inFlightUploads.get(key);
      } else {
        const pending = createFileResource({
          lessonId: req.params.lessonId,
          type,
          file: req.file,
        }).finally(() => {
          setTimeout(() => inFlightUploads.delete(key), 8000);
        });

        inFlightUploads.set(key, pending);
        resource = await pending;
      }

      return res.status(201).json(successResponse({ resource }));
    }

    if (!type || !ALLOWED_TYPES.includes(type)) {
      return next(
        new AppError(`type must be one of: ${ALLOWED_TYPES.join(', ')}.`, 400, 'VALIDATION_ERROR')
      );
    }
    if (!url || !String(url).trim()) {
      return next(new AppError('url is required (upload a file or provide a link URL).', 400, 'VALIDATION_ERROR'));
    }
    if (type === 'link') {
      validateURL(url, 'link URL');
    }

    const trimmedUrl = String(url).trim();

    const existingLink = await prisma.resource.findFirst({
      where: { lessonId: req.params.lessonId, url: trimmedUrl },
    });
    if (existingLink) {
      return res.status(200).json(successResponse({ resource: existingLink }));
    }

    resource = await prisma.resource.create({
      data: { lessonId: req.params.lessonId, type, url: trimmedUrl },
    });

    res.status(201).json(successResponse({ resource }));
  } catch (error) {
    next(error);
  }
};

// ─── DELETE /resources/:id ────────────────────────────────────────────────────
export const deleteResource = async (req, res, next) => {
  try {
    validateUUID(req.params.id, 'resourceId');

    const resource = await prisma.resource.findUnique({
      where: { id: req.params.id },
      include: { lesson: { include: { section: true } } },
    });

    if (!resource) {
      return next(new AppError('Resource not found.', 404, 'NOT_FOUND'));
    }

    await ensureCourseManager(req.user, resource.lesson.section.courseId);

    if (resource.type !== 'link' && resource.url.includes('cloudinary.com')) {
      try {
        const resourceType =
          resource.type === 'video' ? 'video' :
          resource.type === 'image' ? 'image' : 'raw';

        const publicId = publicIdFromCloudinaryUrl(resource.url, {
          keepExtension: resourceType === 'raw',
        });

        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
      } catch {
        // Non-blocking
      }
    }

    await prisma.resource.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
