import prisma from '../config/prisma.js';
import cron from 'node-cron';

/**
 * Cleanup Service - Scheduled Tasks
 * 
 * This service handles periodic cleanup tasks:
 * - Permanently delete soft-deleted accounts after 30 days
 */

const DELETION_THRESHOLD_DAYS = 30;

/**
 * Permanently delete soft-deleted accounts older than 30 days
 */
async function cleanupOldDeletedAccounts() {
  try {
    console.log('[Cleanup Service] Starting cleanup of old soft-deleted accounts...');
    
    const thresholdDate = new Date();
    thresholdDate.setDate(thresholdDate.getDate() - DELETION_THRESHOLD_DAYS);
    
    // Find all soft-deleted accounts older than 30 days
    const oldDeletedAccounts = await prisma.user.findMany({
      where: {
        deletedAt: {
          not: null,
          lte: thresholdDate,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
      },
    });
    
    console.log(`[Cleanup Service] Found ${oldDeletedAccounts.length} accounts to permanently delete`);
    
    if (oldDeletedAccounts.length === 0) {
      console.log('[Cleanup Service] No accounts to delete. Cleanup complete.');
      return;
    }
    
    // Permanently delete each account
    for (const account of oldDeletedAccounts) {
      try {
        // Delete related records first (cascade might not work for all relations)
        await prisma.$transaction([
          // Delete enrollments (this will cascade to payments via the relation)
          prisma.enrollment.deleteMany({
            where: { userId: account.id },
          }),
          // Delete reviews
          prisma.review.deleteMany({
            where: { userId: account.id },
          }),
          // Delete notifications
          prisma.notification.deleteMany({
            where: { userId: account.id },
          }),
          // Delete audit logs
          prisma.auditLog.deleteMany({
            where: { userId: account.id },
          }),
          // Delete the user (this will cascade to other relations with onDelete: Cascade)
          prisma.user.delete({
            where: { id: account.id },
          }),
        ]);
        
        console.log(`[Cleanup Service] Permanently deleted account: ${account.email} (deleted ${account.deletedAt})`);
      } catch (error) {
        console.error(`[Cleanup Service] Failed to delete account ${account.email}:`, error.message);
      }
    }
    
    console.log('[Cleanup Service] Cleanup completed successfully');
  } catch (error) {
    console.error('[Cleanup Service] Cleanup failed:', error);
  }
}

/**
 * Start the cleanup service
 * Runs daily at 2:00 AM
 */
export function startCleanupService() {
  console.log('[Cleanup Service] Starting cleanup service...');
  
  // Schedule cleanup to run daily at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    await cleanupOldDeletedAccounts();
  });
  
  console.log('[Cleanup Service] Cleanup service scheduled to run daily at 2:00 AM');
  
  // Run cleanup immediately on startup (optional - comment out if not desired)
  // cleanupOldDeletedAccounts();
}

/**
 * Manually trigger cleanup (for testing or admin use)
 */
export async function triggerManualCleanup() {
  console.log('[Cleanup Service] Manual cleanup triggered');
  await cleanupOldDeletedAccounts();
}
