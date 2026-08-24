// Одноразовый (но безопасный для повторного запуска) перенос данных из локального
// dev.db в Turso. Требует TURSO_DATABASE_URL и TURSO_AUTH_TOKEN в .env.
//
// Запуск: npx tsx scripts/migrate-to-turso.mjs

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const tursoUrl = process.env.TURSO_DATABASE_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN;

if (!tursoUrl || !tursoToken) {
  console.error("Не заданы TURSO_DATABASE_URL / TURSO_AUTH_TOKEN в .env — сначала заполните их.");
  process.exit(1);
}

const local = new PrismaClient({
  adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./dev.db" }),
});
const remote = new PrismaClient({
  adapter: new PrismaLibSql({ url: tursoUrl, authToken: tursoToken }),
});

function orderProjectsByHierarchy(projects) {
  const byId = new Map(projects.map((p) => [p.id, p]));
  const ordered = [];
  const done = new Set();
  let remaining = [...projects];
  while (remaining.length > 0) {
    const next = remaining.filter((p) => !p.parentId || done.has(p.parentId) || !byId.has(p.parentId));
    if (next.length === 0) break; // защита от циклов, которых быть не должно
    for (const p of next) {
      ordered.push(p);
      done.add(p.id);
    }
    remaining = remaining.filter((p) => !done.has(p.id));
  }
  return ordered;
}

async function main() {
  console.log("Читаю локальную базу...");
  const [projects, tasks, days, settings] = await Promise.all([
    local.project.findMany(),
    local.task.findMany(),
    local.day.findMany(),
    local.appSettings.findMany(),
  ]);
  console.log(`Найдено: ${projects.length} проектов, ${tasks.length} задач, ${days.length} дней.`);

  console.log("Переношу проекты...");
  for (const p of orderProjectsByHierarchy(projects)) {
    await remote.project.upsert({ where: { id: p.id }, create: p, update: p });
  }

  console.log("Переношу задачи...");
  for (const t of tasks) {
    await remote.task.upsert({ where: { id: t.id }, create: t, update: t });
  }

  console.log("Переношу дни (итоги)...");
  for (const d of days) {
    await remote.day.upsert({ where: { id: d.id }, create: d, update: d });
  }

  console.log("Переношу настройки...");
  for (const s of settings) {
    // Google-токены намеренно НЕ переносим — на проде их нужно подключить заново
    // через /settings (redirect URI на localhost всё равно не сработает удалённо).
    await remote.appSettings.upsert({
      where: { id: s.id },
      create: { id: s.id, currentGoal: s.currentGoal },
      update: { currentGoal: s.currentGoal },
    });
  }

  console.log("Готово. Проверяю итог в Turso...");
  console.log({
    projects: await remote.project.count(),
    tasks: await remote.task.count(),
    days: await remote.day.count(),
  });

  await local.$disconnect();
  await remote.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
