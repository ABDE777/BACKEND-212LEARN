import { Router } from 'express';
import { getAllUsers, getUser, updateMe, deleteMe } from '../controllers/user.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();
router.use(protect);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get my profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', (req, res) => {
  const { passwordHash, ...user } = req.user;
  res.status(200).json({ status: 'success', data: { user } });
});

/**
 * @swagger
 * /users/me:
 *   patch:
 *     summary: Update my profile (firstName, lastName, avatar, bio)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               avatar:
 *                 type: string
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.patch('/me', updateMe);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Soft-delete my account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deactivated
 *       401:
 *         description: Unauthorized
 */
router.delete('/me', deleteMe);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: Get all users (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of users
 *       403:
 *         description: Forbidden - admin only
 */
router.get('/', restrictTo('admin'), getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a user by ID (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *       403:
 *         description: Forbidden - admin only
 */
router.get('/:id', restrictTo('admin'), getUser);

export default router;
