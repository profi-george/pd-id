// Одноразовый скрипт: переводит существующую (однопользовательскую) базу на Turso на
// схему с кабинетами (модель User + userId на Project/Task/Day/AppSettings).
//
// Порядок:
//  1. Читает старую singleton-строку AppSettings (если есть) — она будет перенесена
//     первому кабинету после того, как таблица AppSettings будет пересоздана.
//  2. Применяет миграцию add_multiuser_cabinets (создаёт User, добавляет nullable userId).
//  3. Создаёт первый кабинет (имя и PIN — из аргументов командной строки).
//  4. Перепривязывает все существующие Project/Task/Day к этому кабинету.
//  5. Применяет миграцию enforce_user_scoping (userId NOT NULL + внешние ключи,
//     пересоздаёт AppSettings с userId как первичным ключом).
//  6. Переносит сохранённые из шага 1 currentGoal/Google-токены в новую AppSettings.
//
// Запуск: node scripts/migrate-multiuser-turso.mjs "Имя кабинета" "PIN"

import "dotenv/config";
import { createClient } from "@libsql/client";
import { randomBytes, scryptSync, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;
if (!tursoUrl || !tursoToken) {
  console.error("Не заданы TURSO_DATABASE_URL / TURSO_AUTH_TOKEN в .env.");
  process.exit(1);
}

const [, , cabinetName, cabinetPin] = process.argv;
if (!cabinetName || !cabinetPin) {
  console.error('Использование: node scripts/migrate-multiuser-turso.mjs "Имя кабинета" "PIN"');
  process.exit(1);
}

const client = createClient({ url: tursoUrl, authToken: tursoToken });

function hashPin(pin, salt) {
  return scryptSync(pin, salt, 64).toString("hex");
}

function readMigration(folder) {
  return readFileSync(join(process.cwd(), "prisma", "migrations", folder, "migration.sql"), "utf-8");
}

async function main() {
  console.log("1/6 Читаю старые настройки (AppSettings)...");
  let oldSettings = null;
  try {
    const res = await client.execute('SELECT * FROM "AppSettings" WHERE "id" = \'singleton\'');
    oldSettings = res.rows[0] ?? null;
  } catch {
    console.log("   Таблица AppSettings ещё не существует или пуста — пропускаю.");
  }
  console.log(oldSettings ? "   Найдены сохранённые настройки, перенесу их." : "   Настроек не было.");

  console.log("2/6 Применяю миграцию add_multiuser_cabinets...");
  await client.executeMultiple(readMigration("20260824221900_add_multiuser_cabinets"));

  console.log(`3/6 Создаю кабинет «${cabinetName}»...`);
  const userId = randomUUID().replace(/-/g, "").slice(0, 25);
  const salt = randomBytes(16).toString("hex");
  const hash = hashPin(cabinetPin, salt);
  await client.execute({
    sql: 'INSERT INTO "User" ("id","name","pinHash","pinSalt") VALUES (?,?,?,?)',
    args: [userId, cabinetName, hash, salt],
  });

  console.log("4/6 Перепривязываю существующие проекты/задачи/дни к этому кабинету...");
  const projectsRes = await client.execute({ sql: 'UPDATE "Project" SET "userId" = ? WHERE "userId" IS NULL', args: [userId] });
  const tasksRes = await client.execute({ sql: 'UPDATE "Task" SET "userId" = ? WHERE "userId" IS NULL', args: [userId] });
  const daysRes = await client.execute({ sql: 'UPDATE "Day" SET "userId" = ? WHERE "userId" IS NULL', args: [userId] });
  console.log(`   Проектов: ${projectsRes.rowsAffected}, задач: ${tasksRes.rowsAffected}, дней: ${daysRes.rowsAffected}`);

  console.log("5/6 Применяю миграцию enforce_user_scoping...");
  await client.executeMultiple(readMigration("20260824221901_enforce_user_scoping"));

  console.log("6/6 Переношу старые настройки (если были) в новую AppSettings...");
  await client.execute({
    sql: 'INSERT INTO "AppSettings" ("userId","currentGoal","googleAccessToken","googleRefreshToken","googleTokenExpiry","googleAccountEmail") VALUES (?,?,?,?,?,?)',
    args: [
      userId,
      oldSettings?.currentGoal ?? null,
      oldSettings?.googleAccessToken ?? null,
      oldSettings?.googleRefreshToken ?? null,
      oldSettings?.googleTokenExpiry ?? null,
      oldSettings?.googleAccountEmail ?? null,
    ],
  });

  console.log("Готово. Проверяю итог...");
  const counts = await Promise.all(
    ["User", "Project", "Task", "Day", "AppSettings"].map(async (table) => {
      const r = await client.execute(`SELECT COUNT(*) as c FROM "${table}"`);
      return [table, r.rows[0].c];
    })
  );
  console.log(Object.fromEntries(counts));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
