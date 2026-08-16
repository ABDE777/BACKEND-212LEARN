import { Router } from 'express';
import {
  getPendingKyc,
  verifyInstructor,
  refundPayment,
  getAuditLogs,
  getGroups,
  createGroup,
  updateGroup,
  assignGroupFormateur,
  addStudentsToGroup,
  removeStudentFromGroup,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  restoreUser,
  getAdminStats,
} from '../controllers/admin.controller.js';
import { getSettings, updateSettings } from '../controllers/settings.controller.js';
import { protect, restrictTo } from '../middleware/auth.js';

const router = Router();

// ── Admin routes (Require admin authorization) ──────────────────────────────
router.use(protect);
router.use(restrictTo('admin'));

// Platform settings singleton (see settings.controller.js).
router.get('/admin/settings', getSettings);
router.patch('/admin/settings', updateSettings);

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

// Students now self-verify by email (see POST /auth/verify-email/:token), so the
// admin verify/unverify-student endpoint has been removed. Admins still verify
// instructors via /admin/users/:userId/verify (KYC).

/**
 * @swagger
 * /admin/users:
 *   post:
 *     summary: Create a new user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [firstName, lastName, email, password, role]
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *                 format: password
 *               role:
 *                 type: string
 *                 enum: [student, instructor, admin]
 *               isVerified:
 *                 type: boolean
 *     responses:
 *       201:
 *         description: User created successfully
 *       400:
 *         description: Validation error or email already exists
 */
router.post('/admin/users', createUser);

/**
 * @swagger
 * /admin/users/{userId}:
 *   patch:
 *     summary: Update a user (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
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
 *               email:
 *                 type: string
 *                 format: email
 *               role:
 *                 type: string
 *                 enum: [student, instructor, admin]
 *               isVerified:
 *                 type: boolean
 *               bio:
 *                 type: string
 *     responses:
 *       200:
 *         description: User updated successfully
 *       400:
 *         description: Validation error or email already exists
 *       404:
 *         description: User not found
 */
router.patch('/admin/users/:userId', updateUser);

/**
 * @swagger
 * /admin/users/{userId}:
 *   delete:
 *     summary: Delete a user (soft-delete, admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       204:
 *         description: User deleted successfully
 *       400:
 *         description: Cannot delete your own account
 *       404:
 *         description: User not found
 */
router.delete('/admin/users/:userId', deleteUser);

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
 * /admin/groups/{groupId}:
 *   patch:
 *     summary: Update a group (name, description, course) (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: groupId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               courseId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Group updated
 *       404:
 *         description: Group not found
 */
router.patch('/admin/groups/:groupId', updateGroup);

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

// ── Platform statistics ──────────────────────────────────────────────────────
router.get('/admin/stats', getAdminStats);

/**
 * @swagger
 * /admin/users/{userId}/reset-password:
 *   post:
 *     summary: Send password reset email link to a user (admin trigger)
 *     description: |
 *       Admin triggers sending a **5-minute password reset link** to the user's registered email address.
 *       The admin does NOT type the password manually — the user receives an email to set their password safely.
 *       This action is **logged in the audit trail** (`ADMIN_SEND_RESET_EMAIL`).
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         description: UUID of the user to receive the password reset email
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Reset email sent successfully (valid for 5 minutes)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: Forbidden — admin only
 */
router.post('/admin/users/:userId/reset-password', resetUserPassword);
router.patch('/admin/users/:userId/reset-password', resetUserPassword);

/**
 * @swagger
 * /admin/users/{userId}/restore:
 *   patch:
 *     summary: Restore a soft-deleted user account (admin only)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema: { type: string, format: uuid }
 *     responses:
 *       200:
 *         description: User account restored successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SuccessResponse'
 *       400:
 *         description: User is not deleted
 *       404:
 *         description: User not found
 *       403:
 *         description: Forbidden — admin only
 */
router.patch('/admin/users/:userId/restore', restoreUser);

export default router;
