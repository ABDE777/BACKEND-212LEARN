import prisma from '../config/prisma.js';
import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { cloudinary } from '../config/cloudinary.js';
import { ensureCourseManager } from '../utils/authorization.js';

const ALLOWED_TYPES = ['video', 'pdf', 'zip', 'document', 'image', 'link'];

// ─── POST /lessons/:lessonId/resources ───────────────────────────────────────
// Accepts either:
//   - A file upload (multipart/form-data)  → stored on Cloudinary
//   - A plain URL   (application/json)     → type must be 'link'
export const addResource = async (req, res, next) => {
  try {
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
      // Upload all files manually with Cloudinary API to have full control
      let folder = '212learn/misc';
      let resourceType = 'auto';
      let uploadOptions = {
        use_filename: true,
        unique_filename: true,
      };

      if (req.file.mimetype.startsWith('video/')) {
        folder = '212learn/videos';
        resourceType = 'video';
      } else if (req.file.mimetype === 'application/pdf') {
        folder = '212learn/pdfs';
        resourceType = 'raw';
        uploadOptions = {
          ...uploadOptions,
          resource_type: 'raw',
          format: 'pdf',
          pages: false,
          transformation: [],
          access_mode: 'public',
          type: 'upload',
        };
      } else if (
        req.file.mimetype === 'application/zip' ||
        req.file.mimetype === 'application/x-zip-compressed'
      ) {
        folder = '212learn/zips';
        resourceType = 'raw';
        uploadOptions = {
          ...uploadOptions,
          resource_type: 'raw',
          access_mode: 'public',
          type: 'upload',
        };
      } else if (
        req.file.mimetype === 'application/msword' ||
        req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ) {
        folder = '212learn/documents';
        resourceType = 'raw';
        uploadOptions = {
          ...uploadOptions,
          resource_type: 'raw',
          pages: false,
          transformation: [],
          access_mode: 'public',
          type: 'upload',
        };
      } else if (req.file.mimetype.startsWith('image/')) {
        folder = '212learn/images';
        resourceType = 'image';
      }

      uploadOptions.folder = folder;
      if (resourceType !== 'auto') {
        uploadOptions.resource_type = resourceType;
      }

      const result = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          uploadOptions,
          (error, result) => {
            if (error) {
              console.error('Cloudinary upload error:', error);
              reject(error);
            } else {
              console.log('Cloudinary upload success:', result);
              resolve(result);
            }
          }
        ).end(req.file.buffer);
      });

      // For PDFs and documents, construct the raw URL explicitly to ensure original file delivery
      // Cloudinary secure_url format: https://res.cloudinary.com/cloud_name/raw/upload/v1234/folder/public_id.pdf
      // We need to ensure it uses the correct resource_type path
      if (req.file.mimetype === 'application/pdf' ||
          req.file.mimetype === 'application/msword' ||
          req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // The secure_url should already be correct for raw files, but let's verify
        // If it doesn't contain /raw/, we need to construct it properly
        if (!result.secure_url.includes('/raw/')) {
          // Extract parts and construct raw URL
          const urlParts = result.secure_url.split('/');
          const uploadIdx = urlParts.indexOf('upload');
          if (uploadIdx !== -1) {
            urlParts.splice(uploadIdx + 1, 0, 'raw');
            url = urlParts.join('/');
          } else {
            url = result.secure_url;
          }
        } else {
          url = result.secure_url;
        }
      } else {
        url = result.secure_url;
      }

      // Derive type from mimetype if not provided
      if (!type) {
        if (req.file.mimetype.startsWith('video/'))        type = 'video';
        else if (req.file.mimetype === 'application/pdf')  type = 'pdf';
        else if (req.file.mimetype.includes('zip'))        type = 'zip';
        else if (
          req.file.mimetype === 'application/msword' ||
          req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        )                                                   type = 'document';
        else if (req.file.mimetype.startsWith('image/'))   type = 'image';
        else                                               type = 'misc';
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
    if (type === 'link' && !/^https?:\/\/.+/.test(url)) {
      return next(new AppError('link type requires a valid http/https URL.', 400, 'VALIDATION_ERROR'));
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
        // Extract public_id from Cloudinary URL
        // URL format: https://res.cloudinary.com/<cloud>/<type>/upload/v<ver>/<folder>/<public_id>.<ext>
        const urlParts  = resource.url.split('/');
        const uploadIdx = urlParts.indexOf('upload');
        if (uploadIdx !== -1) {
          // Everything after "upload/v<version>/" is the public_id (with extension)
          const publicIdWithExt = urlParts.slice(uploadIdx + 2).join('/');
          const publicId        = publicIdWithExt.replace(/\.[^.]+$/, ''); // strip extension

          const resourceType =
            resource.type === 'video' ? 'video' :
            resource.type === 'image' ? 'image' : 'raw';

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
