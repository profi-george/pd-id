-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "cycleStartDate" DATETIME;
ALTER TABLE "AppSettings" ADD COLUMN "cycleLengthDays" INTEGER;
ALTER TABLE "AppSettings" ADD COLUMN "periodLengthDays" INTEGER;

-- AlterTable
ALTER TABLE "Day" ADD COLUMN "hasPms" BOOLEAN;
