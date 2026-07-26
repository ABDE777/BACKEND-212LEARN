/*
  Warnings:

  - A unique constraint covering the columns `[userId,lessonId]` on the table `lesson_progresses` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "lesson_progresses_userId_lessonId_key" ON "lesson_progresses"("userId", "lessonId");
