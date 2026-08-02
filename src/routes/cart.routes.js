import { Router } from 'express';
import { getCart, addCartItem, removeCartItem, clearCart } from '../controllers/cart.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect, restrictTo('student', 'admin'));

/**
 * @swagger
 * /cart:
 *   get:
 *     summary: Get my shopping cart (auto-creates empty cart)
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cart with items and MAD subtotal
 *   delete:
 *     summary: Clear all items from my cart
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Empty cart
 */
router.get('/', getCart);
router.delete('/', clearCart);

/**
 * @swagger
 * /cart/items:
 *   post:
 *     summary: Add a published course to my cart
 *     tags: [Cart]
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
 *         description: Course added
 *       409:
 *         description: Already in cart or already purchased
 */
router.post('/items', addCartItem);

/**
 * @swagger
 * /cart/items/{itemId}:
 *   delete:
 *     summary: Remove one cart item
 *     tags: [Cart]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated cart
 *       404:
 *         description: Item not found
 */
router.delete('/items/:itemId', removeCartItem);

export default router;
