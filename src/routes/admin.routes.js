import { Router } from 'express';
import {
  getPendingKyc,
  verifyInstructor,
  verifyStudent,
  refundPayment,
  getAuditLogs,
  getGroups,
  createGroup,
  assignGroupFormateur,
  addStudentsToGroup,
  removeStudentFromGroup,
} from '../controllers/admin.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// ── Admin routes (Require admin authorization) ──────────────────────────────
router.use(protect);
router.use(restrictTo('admin'));

/**
 * @swagger
 * /admin/users/pending-kyc:
 *   get:
 *     summary: Retrieve list of instructors awaiting KYC verification (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: List of pending instructors
 *       403:
 *         description: Forbidden
 */
router.get('/admin/users/pending-kyc', getPendingKyc);

/**
 * @swagger
 * /admin/users/{userId}/verify:
 *   patch:
 *     summary: Verify or unverify an instructor profile (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isVerified]
 *             properties:
 *               isVerified:
 *                 type: boolean
 *               notes:
 *                 type: string
 *                 example: "Document ID looks correct."
 *     responses:
 *       200:
 *         description: KYC status updated successfully
 *       400:
 *         description: Invalid input or user role is not instructor
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:userId/verify', verifyInstructor);

/**
 * @swagger
 * /admin/users/{userId}/verify-student:
 *   patch:
 *     summary: Verify or unverify a student account (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [isVerified]
 *             properties:
 *               isVerified:
 *                 type: boolean
 *               notes:
 *                 type: string
 *                 example: "Account verified after manual review."
 *     responses:
 *       200:
 *         description: Student verification status updated successfully
 *       400:
 *         description: Invalid input or user role is not student
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:userId/verify-student', verifyStudent);

/**
 * @swagger
 * /admin/payments/{paymentId}/refund:
 *   patch:
 *     summary: Mark a payment as REFUNDED, revoking student access (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 example: "Student requested refund due to duplicate purchase."
 *     responses:
 *       200:
 *         description: Payment refunded successfully
 *       400:
 *         description: Already refunded
 *       404:
 *         description: Payment not found
 */
router.patch('/admin/payments/:paymentId/refund', refundPayment);

/**
 * @swagger
 * /admin/audit-logs:
 *   get:
 *     summary: Retrieve administrative audit logs (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema: { type: integer, default: 1 }
 *       - in: query
 *         name: limit
 *         schema: { type: integer, default: 20 }
 *     responses:
 *       200:
 *         description: Paginated audit logs list
 */

/**
 * @swagger
 * /admin/groups:
 *   get:
 *     summary: List training groups (admin only)
 *     tags: [Admin]
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
 *         name: courseId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: formateurId
 *         schema: { type: string, format: uuid }
 *       - in: query
 *         name: search
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Paginated group list
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaginatedResponse'
 *   post:
 *     summary: Create a group and assign it to a formateur (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateGroupInput'
 *     responses:
 *       201:
 *         description: Group created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Course or formateur not found
 */
router.get('/admin/groups', getGroups);
router.post('/admin/groups', createGroup);

/**
 * @swagger
 * /admin/groups/{groupId}/formateur:
 *   patch:
 *     summary: Assign or change a group's formateur (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AssignGroupFormateurInput'
 *     responses:
 *       200:
 *         description: Formateur assigned
 *       400:
 *         description: Invalid formateur
 *       404:
 *         description: Group or formateur not found
 */
router.patch('/admin/groups/:groupId/formateur', assignGroupFormateur);

/**
 * @swagger
 * /admin/groups/{groupId}/students:
 *   post:
 *     summary: Add students to a group (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AddGroupStudentsInput'
 *     responses:
 *       200:
 *         description: Students added to group
 *       400:
 *         description: Invalid student ids
 *       404:
 *         description: Group not found
 */
router.post('/admin/groups/:groupId/students', addStudentsToGroup);

/**
 * @swagger
 * /admin/groups/{groupId}/students/{studentId}:
 *   delete:
 *     summary: Remove a student from a group (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *       - in: path
 *         name: studentId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: Student removed from group
 *       404:
 *         description: Membership not found
 */
router.delete('/admin/groups/:groupId/students/:studentId', removeStudentFromGroup);
router.get('/admin/audit-logs', getAuditLogs);

export default router;
