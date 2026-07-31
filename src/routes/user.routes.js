import { Router } from 'express';
import { getAllUsers, getUser, updateMe, deleteMe, uploadAvatar } from '../controllers/user.controller.js';
import { changePassword } from '../controllers/auth.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { upload } from '../config/cloudinary.js';

const router = Router();

// All user routes require authentication
router.use(protect);

/**
 * @swagger
 * /users/me:
 *   get:
 *     summary: Get my own profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Current user profile
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       401:
 *         description: Unauthorized
 */
router.get('/me', (req, res) => {
  const { passwordHash, deletedAt, ...user } = req.user;
  res.status(200).json({ success: true, data: { user } });
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
 *             $ref: '#/components/schemas/UpdateUserInput'
 *     responses:
 *       200:
 *         description: Profile updated
 *       401:
 *         description: Unauthorized
 */
router.patch('/me', updateMe);

/**
 * @swagger
 * /users/me/password:
 *   patch:
 *     summary: Change my own password (requires current password)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [currentPassword, newPassword]
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       200:
 *         description: Password updated successfully
 *       401:
 *         description: Current password is incorrect
 */
router.patch('/me/password', changePassword);

/**
 * @swagger
 * /users/me:
 *   delete:
 *     summary: Deactivate (soft-delete) my account
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       204:
 *         description: Account deactivated — no content returned
 *       401:
 *         description: Unauthorized
 */
router.delete('/me', deleteMe);

/**
 * @swagger
 * /users/me/avatar:
 *   post:
 *     summary: Upload avatar image (multipart/form-data)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               avatar:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: Avatar uploaded successfully
 *       400:
 *         description: No file uploaded or invalid file type
 *       401:
 *         description: Unauthorized
 */
router.post('/me/avatar', upload.single('avatar'), uploadAvatar);

/**
 * @swagger
 * /users:
 *   get:
 *     summary: List all users with pagination and filters (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *       - in: query
 *         name: role
 *         schema: { type: string, enum: [student, instructor, admin] }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *         description: Search by firstName, lastName or email
 *       - in: query
 *         name: sort
 *         schema: { type: string, enum: [createdAt, firstName, lastName, email, role], default: createdAt }
 *       - in: query
 *         name: order
 *         schema: { type: string, enum: [asc, desc], default: desc }
 *     responses:
 *       200:
 *         description: Paginated list of users
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *       403:
 *         description: Forbidden — admin only
 */
router.get('/', restrictTo('admin'), getAllUsers);

/**
 * @swagger
 * /users/{id}:
 *   get:
 *     summary: Get a specific user by ID (admin only)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User found
 *       404:
 *         description: User not found
 *       403:
 *         description: Forbidden
 */
router.get('/:id', restrictTo('admin'), getUser);

export default router;
