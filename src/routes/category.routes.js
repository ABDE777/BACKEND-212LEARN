import { Router } from 'express';
import { getCategories, createCategory } from '../controllers/category.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /categories:
 *   get:
 *     summary: Retrieve all categories in a parent-child tree structure
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: Success
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 * 
 *   post:
 *     summary: Create a new category (Admin only)
 *     tags: [Categories]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: Web Development
 *               description:
 *                 type: string
 *                 example: Build websites using HTML, CSS, JavaScript, etc.
 *               parentId:
 *                 type: string
 *                 format: uuid
 *                 example: d4b3b1ba-1be9-450f-bbbf-f91b5c2d3b4a
 *     responses:
 *       201:
 *         description: Category created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Not an admin)
 *       409:
 *         description: Category name conflict
 */
router.route('/')
  .get(getCategories)
  .post(protect, restrictTo('admin'), createCategory);

export default router;
