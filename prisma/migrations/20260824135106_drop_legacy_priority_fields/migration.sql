-- Значения уже перенесены в новые колонки (value/costOfDelay/effortMinutes) отдельным скриптом.
ALTER TABLE "Task" DROP COLUMN "importance";
ALTER TABLE "Task" DROP COLUMN "energy";
ALTER TABLE "Task" DROP COLUMN "timeHours";
