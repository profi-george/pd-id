// Разово применяет к Turso миграцию полей Telegram-бота у пользователя
// (push-schema-to-turso.mjs проигрывает ВСЕ миграции и годится только для
// пустой базы). Только добавляет колонки, повторный запуск безопасен.
//
// Запуск: npx tsx scripts/apply-telegram-migration-turso.mjs

import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
  const cols = await client.execute(`PRAGMA table_info("User")`);
  if (cols.rows.some((c) => c.name === "telegramChatId")) {
    console.log("Поля Telegram уже есть.");
    return;
  }
  await client.executeMultiple(readFileSync("prisma/migrations/20261116120000_add_user_telegram/migration.sql", "utf-8"));
  console.log("Поля Telegram добавлены.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
