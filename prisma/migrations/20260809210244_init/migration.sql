/*
  Warnings:

  - A unique constraint covering the columns `[cartId,courseId]` on the table `cart_items` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,courseId]` on the table `wishlists` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "icon" VARCHAR(50);

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "thumbnail" VARCHAR(500);

-- AlterTable
ALTER TABLE "meetings" ADD COLUMN     "durationMinutes" INTEGER,
ADD COLUMN     "recordingUrl" VARCHAR(500),
ADD COLUMN     "roomName" VARCHAR(255),
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "restoreOtp" VARCHAR(255),
ADD COLUMN     "restoreOtpExp" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "cart_items_cartId_courseId_key" ON "cart_items"("cartId", "courseId");

-- CreateIndex
CREATE INDEX "meetings_status_idx" ON "meetings"("status");

-- CreateIndex
CREATE UNIQUE INDEX "wishlists_userId_courseId_key" ON "wishlists"("userId", "courseId");
