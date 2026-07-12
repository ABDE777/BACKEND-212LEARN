import { Router } from 'express';
import { addResource, deleteResource } from '../controllers/resource.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = Router();

/**
 * @swagger
 * /lessons/{lessonId}/resources:
 *   post:
 *     summary: Attach a resource to a lesson — upload a file OR provide an external link (instructor / admin)
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: lessonId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Video, PDF, ZIP, or image file (max 200 MB)
 *               type:
 *                 type: string
 *                 enum: [video, pdf, zip, image, link]
 *                 description: Omit when uploading a file — auto-detected from mimetype
 *               url:
 *                 type: string
 *                 description: Required only for type=link (external URL)
 *         application/json:
 *           schema:
 *             type: object
 *             required: [type, url]
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [link]
 *               url:
 *                 type: string
 *                 format: uri
 *                 example: https://youtube.com/watch?v=abc123
 *     responses:
 *       201:
 *         description: Resource attached
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Lesson not found
 */
router.post(
  '/lessons/:lessonId/resources',
  protect,
  restrictTo('instructor', 'admin'),
  upload.single('file'),   // multer-cloudinary: optional — if no file, falls through to body.url
  addResource
);

/**
 * @swagger
 * /resources/{id}:
 *   delete:
 *     summary: Remove a resource from a lesson (instructor / admin)
 *     tags: [Resources]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Resource deleted — no content
 *       404:
 *         description: Resource not found
 */
router.delete('/resources/:id', protect, restrictTo('instructor', 'admin'), deleteResource);

export default router;
