// Разово применяет миграцию тегов к Turso (push-schema-to-turso.mjs проигрывает
// ВСЕ миграции и годится только для пустой базы), заводит каждому пользователю
// стартовые метки и убирает больше не нужную задачу-напоминание от Дневника.
// Повторный запуск безопасен.
//
// Запуск: npx tsx scripts/apply-tags-migration-turso.mjs

import "dotenv/config";
import { createClient } from "@libsql/client";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";

const DEFAULT_TAGS = ["Разработчику", "Инстаграм", "ИИ"];

const client = createClient({ url: process.env.TURSO_DATABASE_URL, authToken: process.env.TURSO_AUTH_TOKEN });

async function main() {
  const exists = await client.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='Tag'");
  if (exists.rows.length === 0) {
    await client.executeMultiple(readFileSync("prisma/migrations/20261026120000_add_task_tags/migration.sql", "utf-8"));
    console.log("Таблицы тегов созданы.");
  } else {
    console.log("Таблицы тегов уже есть.");
  }

  const users = await client.execute('SELECT id FROM "User"');
  for (const u of users.rows) {
    for (const name of DEFAULT_TAGS) {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO "Tag" (id, name, userId) VALUES (?, ?, ?)',
        args: [randomUUID(), name, u.id],
      });
    }
  }
  console.log(`Стартовые метки у ${users.rows.length} пользователей.`);

  const del = await client.execute(
    `DELETE FROM "Task" WHERE text LIKE 'Снять просроченные проверки в Дневнике%' AND status IN ('PLANNED','BACKLOG')`
  );
  console.log(`Удалено задач-напоминаний Дневника: ${del.rowsAffected}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
