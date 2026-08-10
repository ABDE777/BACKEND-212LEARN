import prisma from './src/config/prisma.js';
import { triggerManualCleanup } from './src/services/cleanup.service.js';

async function testAutoDeletion() {
  console.log('=== Testing Auto-Deletion Functionality ===\n');
  
  try {
    // Step 1: Create a test user
    console.log('Step 1: Creating test user...');
    const testUser = await prisma.user.create({
      data: {
        email: `test-deletion-${Date.now()}@example.com`,
        firstName: 'Test',
        lastName: 'Deletion',
        passwordHash: 'dummy-hash',
        role: 'student',
        isVerified: false,
      },
    });
    console.log(`✓ Created test user: ${testUser.email} (ID: ${testUser.id})\n`);
    
    // Step 2: Soft-delete the user with a date older than 30 days
    console.log('Step 2: Soft-deleting user with old timestamp...');
    const oldDate = new Date();
    oldDate.setDate(oldDate.getDate() - 35); // 35 days ago
    
    await prisma.user.update({
      where: { id: testUser.id },
      data: { deletedAt: oldDate },
    });
    console.log(`✓ User soft-deleted with timestamp: ${oldDate.toISOString()}\n`);
    
    // Step 3: Verify user is soft-deleted
    console.log('Step 3: Verifying soft-deletion...');
    const softDeletedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    if (softDeletedUser && softDeletedUser.deletedAt) {
      console.log(`✓ User is soft-deleted: ${softDeletedUser.deletedAt.toISOString()}\n`);
    } else {
      throw new Error('User should be soft-deleted but is not');
    }
    
    // Step 4: Trigger manual cleanup
    console.log('Step 4: Triggering manual cleanup...');
    await triggerManualCleanup();
    console.log('✓ Cleanup completed\n');
    
    // Step 5: Verify user is permanently deleted
    console.log('Step 5: Verifying permanent deletion...');
    const deletedUser = await prisma.user.findUnique({
      where: { id: testUser.id },
    });
    
    if (!deletedUser) {
      console.log('✓ SUCCESS: User has been permanently deleted from database\n');
    } else {
      console.log('✗ FAILURE: User still exists in database');
      console.log(`User data:`, deletedUser);
    }
    
    // Step 6: Test with a recently deleted user (should NOT be deleted)
    console.log('\n=== Testing Recent Deletion (Should NOT be deleted) ===\n');
    
    const recentUser = await prisma.user.create({
      data: {
        email: `test-recent-${Date.now()}@example.com`,
        firstName: 'Recent',
        lastName: 'Deletion',
        passwordHash: 'dummy-hash',
        role: 'student',
        isVerified: false,
      },
    });
    console.log(`✓ Created recent test user: ${recentUser.email} (ID: ${recentUser.id})\n`);
    
    // Soft-delete with recent date (5 days ago)
    const recentDate = new Date();
    recentDate.setDate(recentDate.getDate() - 5);
    
    await prisma.user.update({
      where: { id: recentUser.id },
      data: { deletedAt: recentDate },
    });
    console.log(`✓ User soft-deleted with recent timestamp: ${recentDate.toISOString()}\n`);
    
    // Trigger cleanup again
    console.log('Triggering cleanup again...');
    await triggerManualCleanup();
    console.log('✓ Cleanup completed\n');
    
    // Verify recent user is NOT deleted
    const stillExists = await prisma.user.findUnique({
      where: { id: recentUser.id },
    });
    
    if (stillExists && stillExists.deletedAt) {
      console.log('✓ SUCCESS: Recent user still exists (as expected)\n');
      // Clean up the test user
      await prisma.user.delete({ where: { id: recentUser.id } });
      console.log('✓ Cleaned up test user');
    } else {
      console.log('✗ FAILURE: Recent user was deleted (should not have been)');
    }
    
    console.log('\n=== Test Complete ===');
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testAutoDeletion();
