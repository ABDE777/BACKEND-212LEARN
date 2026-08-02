import { Router } from 'express';
import { getWishlist, addToWishlist, removeFromWishlist } from '../controllers/wishlist.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect, restrictTo('student', 'admin'));

/**
 * @swagger
 * /wishlist:
 *   get:
 *     summary: List my wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Wishlist items
 *   post:
 *     summary: Add a published course to wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [courseId]
 *             properties:
 *               courseId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       201:
 *         description: Added
 *       409:
 *         description: Already wishlisted
 */
router.get('/', getWishlist);
router.post('/', addToWishlist);

/**
 * @swagger
 * /wishlist/{courseId}:
 *   delete:
 *     summary: Remove a course from wishlist
 *     tags: [Wishlist]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: courseId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Removed
 *       404:
 *         description: Not found
 */
router.delete('/:courseId', removeFromWishlist);

export default router;
