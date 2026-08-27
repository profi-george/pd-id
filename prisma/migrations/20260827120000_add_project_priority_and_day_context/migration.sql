-- AlterTable
ALTER TABLE "Project" ADD COLUMN "priority" TEXT;

-- AlterTable
ALTER TABLE "Day" ADD COLUMN "cycleDay" INTEGER;
ALTER TABLE "Day" ADD COLUMN "hadConflict" BOOLEAN;
ALTER TABLE "Day" ADD COLUMN "conflictWith" TEXT;
ALTER TABLE "Day" ADD COLUMN "conflictAbout" TEXT;
