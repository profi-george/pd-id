-- AlterTable
ALTER TABLE "Task" ADD COLUMN "aiCostOfDelay" INTEGER;
ALTER TABLE "Task" ADD COLUMN "aiEffortMinutes" INTEGER;
ALTER TABLE "Task" ADD COLUMN "aiReasoningCostOfDelay" TEXT;
ALTER TABLE "Task" ADD COLUMN "aiReasoningEffort" TEXT;
ALTER TABLE "Task" ADD COLUMN "aiReasoningTimeSensitivity" TEXT;
ALTER TABLE "Task" ADD COLUMN "aiReasoningUrgency" TEXT;
ALTER TABLE "Task" ADD COLUMN "aiReasoningValue" TEXT;
ALTER TABLE "Task" ADD COLUMN "aiTimeSensitivity" INTEGER;
ALTER TABLE "Task" ADD COLUMN "aiUrgency" INTEGER;
ALTER TABLE "Task" ADD COLUMN "aiValue" INTEGER;
