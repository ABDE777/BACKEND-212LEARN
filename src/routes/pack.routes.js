import { Router } from 'express';
import {
  getPacks,
  getPack,
  createPack,
  updatePack,
  deletePack,
} from '../controllers/pack.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';
import { optionalProtect } from '../middleware/enrollment.js';

const router = Router();

/**
 * @swagger
 * /packs:
 *   get:
 *     summary: List packs (published for everyone, all for admins)
 *     tags: [Packs]
 *     responses:
 *       200:
 *         description: Packs with per-pack early-bird pricing
 *   post:
 *     summary: Create a pack from existing courses (admin)
 *     tags: [Packs]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title, price, courses]
 *             properties:
 *               title: { type: string }
 *               description: { type: string }
 *               thumbnail: { type: string }
 *               price: { type: number, description: Normal pack price }
 *               launchPrice: { type: number, description: Early-bird price for the first launchSeats buyers }
 *               launchSeats: { type: integer, description: Number of early-bird seats (e.g. 5) }
 *               currency: { type: string, example: MAD }
 *               status: { type: string, enum: [draft, published, archived] }
 *               courses:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [courseId]
 *                   properties:
 *                     courseId: { type: string, format: uuid }
 *                     instructorId: { type: string, format: uuid, description: Must teach the course; auto-selected when the course has a single instructor }
 *     responses:
 *       201:
 *         description: Pack created
 */
router.get('/', optionalProtect, getPacks);
router.post('/', protect, restrictTo('admin'), createPack);

/**
 * @swagger
 * /packs/{id}:
 *   get:
 *     summary: Get a pack by id
 *     tags: [Packs]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Pack details
 *       404:
 *         description: Not found
 *   patch:
 *     summary: Update a pack (admin)
 *     tags: [Packs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated
 *   delete:
 *     summary: Soft-delete a pack (admin)
 *     tags: [Packs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Deleted
 */
router.get('/:id', optionalProtect, getPack);
router.patch('/:id', protect, restrictTo('admin'), updatePack);
router.delete('/:id', protect, restrictTo('admin'), deletePack);

export default router;
