import { Router } from 'express';
import { signCloudinaryUpload } from '../controllers/upload.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /uploads/cloudinary-sign:
 *   post:
 *     summary: Get a Cloudinary upload signature (direct browser upload — required for files > ~4 MB on Vercel)
 *     description: |
 *       Vercel rejects request bodies over 4.5 MB (`FUNCTION_PAYLOAD_TOO_LARGE`).
 *       For PDFs/ZIPs/videos/images above ~4 MB:
 *       1. Call this endpoint
 *       2. POST the file to `uploadUrl` with the returned form fields
 *       3. POST `{ type, url: secure_url }` to `/lessons/:lessonId/resources`
 *     tags: [Uploads]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, filename]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [video, pdf, zip, document, image]
 *               filename:
 *                 type: string
 *                 example: course-notes.pdf
 *               mimetype:
 *                 type: string
 *                 example: application/pdf
 *     responses:
 *       200:
 *         description: Signature + upload URL for Cloudinary
 *       400:
 *         description: Validation error
 */
router.post(
  '/cloudinary-sign',
  protect,
  restrictTo('instructor', 'admin'),
  signCloudinaryUpload
);

export default router;
