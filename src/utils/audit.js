import prisma from '../config/prisma.js';

/**
 * Logs an administrative action to the audit_logs table.
 * @param {string|null} userId - The user performing the action (null if system)
 * @param {string} action - The action name (e.g., 'VERIFY_INSTRUCTOR', 'REFUND_PAYMENT')
 * @param {string} resource - The target resource name (e.g., 'User', 'Payment')
 * @param {string|null} resourceId - The ID of the target resource
 * @param {object|null} details - Additional metadata or payload details
 */
export const logAuditEvent = async (userId, action, resource, resourceId, details = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        details: details ? JSON.parse(JSON.stringify(details)) : null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
};
