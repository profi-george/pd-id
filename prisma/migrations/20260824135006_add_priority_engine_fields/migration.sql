-- CreateTable
CREATE TABLE "AppSettings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "currentGoal" TEXT
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "projectId" TEXT,
    "importance" INTEGER NOT NULL,
    "urgency" INTEGER NOT NULL,
    "energy" INTEGER NOT NULL,
    "timeHours" REAL NOT NULL,
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
    "date" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'BACKLOG',
    "order" INTEGER NOT NULL DEFAULT 0,
    "score" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Task" ("createdAt", "date", "energy", "id", "importance", "order", "projectId", "score", "status", "text", "timeHours", "updatedAt", "urgency") SELECT "createdAt", "date", "energy", "id", "importance", "order", "projectId", "score", "status", "text", "timeHours", "updatedAt", "urgency" FROM "Task";
DROP TABLE "Task";
ALTER TABLE "new_Task" RENAME TO "Task";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
