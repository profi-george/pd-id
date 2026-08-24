-- AlterTable
ALTER TABLE "AppSettings" ADD COLUMN "googleAccessToken" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "googleAccountEmail" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "googleRefreshToken" TEXT;
ALTER TABLE "AppSettings" ADD COLUMN "googleTokenExpiry" DATETIME;

-- AlterTable
ALTER TABLE "Task" ADD COLUMN "googleEventId" TEXT;
ALTER TABLE "Task" ADD COLUMN "googleEventUrl" TEXT;
