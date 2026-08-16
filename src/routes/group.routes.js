import { Router } from 'express';
import {
  getAllGroups,
  getGroup,
  createGroup,
  updateGroup,
  deleteGroup,
  addStudentToGroup,
  removeStudentFromGroup,
  getGroupStudents,
  getMyGroups,
} from '../controllers/group.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

/**
 * @swagger
 * /groups:
 *   get:
 *     summary: List all groups (admin)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer }
 *       - in: query
 *         name: limit
 *         schema: { type: integer }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *       - in: query
 *         name: courseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formateurId
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Paginated groups
 *   post:
 *     summary: Create a group (admin)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, formateurId]
 *             properties:
 *               name: { type: string, example: "Groupe A" }
 *               description: { type: string }
 *               courseId: { type: string, format: uuid }
 *               formateurId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Group created
 */
router.get('/', protect, restrictTo('admin'), getAllGroups);
router.post('/', protect, restrictTo('admin'), createGroup);

/**
 * @swagger
 * /groups/mine:
 *   get:
 *     summary: List the authenticated student's own group memberships
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: The student's groups with course and formateur
 */
// Must be declared before `/:id` so "mine" isn't captured as a group id.
router.get('/mine', protect, getMyGroups);
router.get('/my-groups', protect, getMyGroups);

/**
 * @swagger
 * /groups/{id}:
 *   get:
 *     summary: Get a group by ID (admin)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Group details
 *   patch:
 *     summary: Update a group (admin)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name: { type: string }
 *               description: { type: string }
 *               courseId: { type: string, format: uuid }
 *               formateurId: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: Updated group
 *   delete:
 *     summary: Delete a group (admin)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Deleted
 */
router.get('/:id', protect, restrictTo('admin'), getGroup);
router.patch('/:id', protect, restrictTo('admin'), updateGroup);
router.delete('/:id', protect, restrictTo('admin'), deleteGroup);

/**
 * @swagger
 * /groups/{id}/students:
 *   post:
 *     summary: Add a paid student to a group (admin, or the group's own formateur)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [userId]
 *             properties:
 *               userId: { type: string, format: uuid }
 *     responses:
 *       201:
 *         description: Student added
 */
router.post('/:id/students', protect, restrictTo('instructor', 'admin'), addStudentToGroup);

/**
 * @swagger
 * /groups/{id}/students/{userId}:
 *   delete:
 *     summary: Remove a student from a group (admin, or the group's own formateur)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Student removed
 */
router.delete('/:id/students/:userId', protect, restrictTo('instructor', 'admin'), removeStudentFromGroup);

/**
 * @swagger
 * /groups/{id}/students:
 *   get:
 *     summary: List the students of a group (admin, or the group's own formateur)
 *     tags: [Groups]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: The group and its students
 *       403:
 *         description: Not the group's formateur
 */
router.get('/:id/students', protect, restrictTo('instructor', 'admin'), getGroupStudents);

export default router;
