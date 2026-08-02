import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import {
  cloudinary,
  uploadBufferToCloudinary,
  publicIdFromCloudinaryUrl,
} from '../config/cloudinary.js';
import { ensureCourseManager } from '../utils/authorization.js';
import { validateUUID, validateURL } from '../utils/validation.js';

const ALLOWED_TYPES = ['video', 'pdf', 'zip', 'document', 'image', 'link'];

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

// ─── POST /lessons/:lessonId/resources ───────────────────────────────────────
// Accepts either:
//   - A file upload (multipart/form-data)  → stored on Cloudinary
//   - A plain URL   (application/json)     → type must be 'link'
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

    // ── File upload path ──────────────────────────────────────────────────────
    if (req.file) {
      const result = await uploadBufferToCloudinary(req.file);
      url = result.secure_url;

      if (!type) {
        type = typeFromMimetype(req.file.mimetype);
      }
    }

    // ── Validation ───────────────────────────────────────────────────────────
    if (!type || !ALLOWED_TYPES.includes(type)) {
      return next(
        new AppError(`type must be one of: ${ALLOWED_TYPES.join(', ')}.`, 400, 'VALIDATION_ERROR')
      );
    }
    if (!url || !url.trim()) {
      return next(new AppError('url is required (upload a file or provide a link URL).', 400, 'VALIDATION_ERROR'));
    }
    if (type === 'link') {
      validateURL(url, 'link URL');
    }

    const resource = await prisma.resource.create({
      data: { lessonId: req.params.lessonId, type, url: url.trim() },
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

    // If URL is from Cloudinary, delete from Cloudinary too
    if (resource.type !== 'link' && resource.url.includes('cloudinary.com')) {
      try {
        const resourceType =
          resource.type === 'video' ? 'video' :
          resource.type === 'image' ? 'image' : 'raw';

        // Raw public_ids include the extension — do not strip it
        const publicId = publicIdFromCloudinaryUrl(resource.url, {
          keepExtension: resourceType === 'raw',
        });

        if (publicId) {
          await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
        }
      } catch {
        // Non-blocking: if Cloudinary deletion fails, continue with DB deletion
      }
    }

    await prisma.resource.delete({ where: { id: req.params.id } });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
