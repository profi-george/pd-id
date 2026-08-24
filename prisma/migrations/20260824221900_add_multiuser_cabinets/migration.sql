-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "pinSalt" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_name_key" ON "User"("name");

-- AlterTable: добавляем nullable userId — колонки станут обязательными следующей
-- миграцией, после того как скрипт перепривяжет существующие строки к кабинету.
ALTER TABLE "Project" ADD COLUMN "userId" TEXT;
ALTER TABLE "Task" ADD COLUMN "userId" TEXT;
ALTER TABLE "Day" ADD COLUMN "userId" TEXT;
