import { PrismaClient } from "@/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// На Vercel файловая система только для чтения и не переживает между запросами —
// там подключаемся к Turso (libSQL). Локально по умолчанию остаёмся на обычном
// файле SQLite, чтобы разработка не зависела от сети.
const tursoUrl = process.env.TURSO_DATABASE_URL;

const adapter = tursoUrl
  ? new PrismaLibSql({ url: tursoUrl, authToken: process.env.TURSO_AUTH_TOKEN })
  : new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
