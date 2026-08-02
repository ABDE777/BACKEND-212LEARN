import { AppError } from '../middleware/error.js';
import { successResponse } from '../utils/response.js';
import { createSignedUpload, resolveTargetByType } from '../config/cloudinary.js';
import { validateRequired } from '../utils/validation.js';

const ALLOWED_UPLOAD_TYPES = ['video', 'pdf', 'zip', 'document', 'image'];

/**
 * POST /uploads/cloudinary-sign
 * Returns a short-lived signature so the browser uploads the file
 * straight to Cloudinary (avoids Vercel 4.5 MB FUNCTION_PAYLOAD_TOO_LARGE).
 *
 * Body: { type: 'pdf'|'zip'|'video'|'image'|'document', filename: 'notes.pdf', mimetype?: string }
 */
export const signCloudinaryUpload = async (req, res, next) => {
  try {
    validateRequired(req.body, ['type', 'filename']);

    const { type, filename, mimetype } = req.body;

    if (!ALLOWED_UPLOAD_TYPES.includes(type)) {
      return next(
        new AppError(
          `type must be one of: ${ALLOWED_UPLOAD_TYPES.join(', ')}.`,
          400,
          'VALIDATION_ERROR'
        )
      );
    }

    if (!resolveTargetByType(type)) {
      return next(new AppError('Invalid upload type.', 400, 'VALIDATION_ERROR'));
    }

    if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_SECRET) {
      return next(new AppError('Cloudinary is not configured.', 500, 'CONFIG_ERROR'));
    }

    const signed = createSignedUpload({
      type,
      filename: String(filename),
      mimetype: mimetype ? String(mimetype) : undefined,
    });

    res.status(200).json(
      successResponse({
        ...signed,
        // Frontend instructions (also in API docs)
        formFields: {
          file: '<File>',
          api_key: signed.apiKey,
          timestamp: signed.timestamp,
          signature: signed.signature,
          folder: signed.folder,
          public_id: signed.public_id,
        },
      })
    );
  } catch (error) {
    next(error);
  }
};
