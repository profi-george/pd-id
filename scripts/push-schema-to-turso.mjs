// Применяет все Prisma-миграции (структуру таблиц) к пустой базе Turso напрямую через
// libSQL-клиент — CLI-команды Prisma migrate не поддерживают удалённый libsql:// URL
// напрямую, поэтому проигрываем те же SQL-файлы, что и локально, но по сети.
//
// Запуск: npx tsx scripts/push-schema-to-turso.mjs

import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("Не заданы TURSO_DATABASE_URL / TURSO_AUTH_TOKEN в .env — сначала заполните их.");
  process.exit(1);
}

const migrationsDir = join(process.cwd(), "prisma", "migrations");
const folders = readdirSync(migrationsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

const client = createClient({ url: tursoUrl, authToken: tursoToken });

async function main() {
  for (const folder of folders) {
    const sqlPath = join(migrationsDir, folder, "migration.sql");
    const sql = readFileSync(sqlPath, "utf-8");
    console.log(`Применяю ${folder}...`);
    await client.executeMultiple(sql);
  }
  console.log("Структура таблиц создана в Turso.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
