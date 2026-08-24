-- Данные в userId уже заполнены отдельным скриптом (scripts/migrate-multiuser-turso.mjs)
-- перед применением этой миграции — теперь делаем колонку обязательной и добавляем FK.

PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

-- RedefineTable: Project
CREATE TABLE "new_Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "parentId" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Project_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Project" ("id", "name", "parentId", "userId", "createdAt")
  SELECT "id", "name", "parentId", "userId", "createdAt" FROM "Project";
DROP TABLE "Project";
ALTER TABLE "new_Project" RENAME TO "Project";

-- RedefineTable: Task
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "projectId" TEXT,
    "userId" TEXT NOT NULL,
    "urgency" INTEGER NOT NULL,
    "resultText" TEXT,
    "motivationText" TEXT,
    "value" INTEGER NOT NULL DEFAULT 3,
    "costOfDelay" INTEGER NOT NULL DEFAULT 3,
    "timeSensitivity" INTEGER NOT NULL DEFAULT 3,
    "goalAlignment" INTEGER NOT NULL DEFAULT 3,
    "effortMinutes" INTEGER NOT NULL DEFAULT 30,
    "alternativeQuality" REAL NOT NULL DEFAULT 0,
    "confidence" REAL NOT NULL DEFAULT 0.6,
    "deadline" DATETIME,
    "financialConsequence" BOOLEAN NOT NULL DEFAULT false,
    "primaryReason" TEXT,
    "riskText" TEXT,
    "aiValue" INTEGER,
    "aiCostOfDelay" INTEGER,
    "aiUrgency" INTEGER,
    "aiTimeSensitivity" INTEGER,
    "aiEffortMinutes" INTEGER,
    "aiReasoningValue" TEXT,
    "aiReasoningCostOfDelay" TEXT,
    "aiReasoningUrgency" TEXT,
    "aiReasoningTimeSensitivity" TEXT,
    "aiReasoningEffort" TEXT,
    "manualPriority" TEXT,
    "googleEventId" TEXT,
    "googleEventUrl" TEXT,
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "order" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("id","text","projectId","userId","urgency","resultText","motivationText","value","costOfDelay","timeSensitivity","goalAlignment","effortMinutes","alternativeQuality","confidence","deadline","financialConsequence","primaryReason","riskText","aiValue","aiCostOfDelay","aiUrgency","aiTimeSensitivity","aiEffortMinutes","aiReasoningValue","aiReasoningCostOfDelay","aiReasoningUrgency","aiReasoningTimeSensitivity","aiReasoningEffort","manualPriority","googleEventId","googleEventUrl","date","status","order","score","createdAt","updatedAt")
  SELECT "id","text","projectId","userId","urgency","resultText","motivationText","value","costOfDelay","timeSensitivity","goalAlignment","effortMinutes","alternativeQuality","confidence","deadline","financialConsequence","primaryReason","riskText","aiValue","aiCostOfDelay","aiUrgency","aiTimeSensitivity","aiEffortMinutes","aiReasoningValue","aiReasoningCostOfDelay","aiReasoningUrgency","aiReasoningTimeSensitivity","aiReasoningEffort","manualPriority","googleEventId","googleEventUrl","date","status","order","score","createdAt","updatedAt" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";

-- RedefineTable: Day (userId NOT NULL + FK, unique constraint becomes (userId, date))
CREATE TABLE "new_Day" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "whyWorked" TEXT,
    "whyNotWorked" TEXT,
    "difficulty" INTEGER,
    "mood" INTEGER,
    "efficiency" INTEGER,
    "worry" INTEGER,
    "conclusion" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Day_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Day" ("id","userId","date","whyWorked","whyNotWorked","difficulty","mood","efficiency","worry","conclusion","createdAt","updatedAt")
  SELECT "id","userId","date","whyWorked","whyNotWorked","difficulty","mood","efficiency","worry","conclusion","createdAt","updatedAt" FROM "Day";
DROP TABLE "Day";
ALTER TABLE "new_Day" RENAME TO "Day";
CREATE UNIQUE INDEX "Day_userId_date_key" ON "Day"("userId", "date");

-- RedefineTable: AppSettings (id "singleton" PK -> userId PK)
CREATE TABLE "new_AppSettings" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "currentGoal" TEXT,
    "googleAccessToken" TEXT,
    "googleRefreshToken" TEXT,
    "googleTokenExpiry" DATETIME,
    "googleAccountEmail" TEXT,
    CONSTRAINT "AppSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
DROP TABLE "AppSettings";
ALTER TABLE "new_AppSettings" RENAME TO "AppSettings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
