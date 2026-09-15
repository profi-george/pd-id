import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { todayDate } from "@/lib/dates";
import AppShell from "@/components/AppShell";

const ACTIVE_STATUSES = [TaskStatus.BACKLOG, TaskStatus.PLANNED];

export const dynamic = "force-dynamic";

// Отмечает синтетические задачи-напоминания от Дневника — по нему находим
// свою же задачу на следующем заходе, чтобы обновить/закрыть её, а не плодить
// дубликаты. Держим здесь же (а не в схеме) — это единственное место, где
// вообще есть эта интеграция.
const DNEVNIK_TASK_PREFIX = "Снять просроченные проверки в Дневнике";
const DNEVNIK_OVERDUE_URL = "https://dnevnik-gold.vercel.app/api/overdue-checkpoints";

// Тянем число просроченных проверок из Дневника и держим ОДНУ задачу-нашёптыш
// в плане дня, пока оно больше нуля — закрывается сама, когда в Дневнике всё
// снято. Дневник не знает о ПД-ИД ничего, кроме этого одного публичного
// счётчика — вся логика связи живёт здесь. Сбой Дневника (недоступен, долго
// отвечает) не должен мешать открыть свой собственный план дня, поэтому любая
// ошибка молча проглатывается.
async function syncDnevnikOverdueTask(userId: string) {
  let overdueCount = 0;
  try {
    const res = await fetch(DNEVNIK_OVERDUE_URL, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    if (!res.ok) return;
    const data = (await res.json()) as { overdueCount?: number };
    overdueCount = Number(data.overdueCount) || 0;
  } catch {
    return;
  }

  const existing = await prisma.task.findFirst({
    where: { userId, text: { startsWith: DNEVNIK_TASK_PREFIX }, status: { in: [TaskStatus.PLANNED, TaskStatus.BACKLOG] } },
  });

  if (overdueCount === 0) {
    if (existing) await prisma.task.delete({ where: { id: existing.id } });
    return;
  }

  const text = `${DNEVNIK_TASK_PREFIX} (${overdueCount})`;
  if (existing) {
    if (existing.text !== text) {
      await prisma.task.update({ where: { id: existing.id }, data: { text } });
    }
  } else {
    await prisma.task.create({
      data: { text, userId, urgency: 4, effortMinutes: 15, date: todayDate(), status: TaskStatus.PLANNED },
    });
  }
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  // Автоперенос: задача, которую не отметили выполненной/невыполненной, молча
  // остаётся в статусе PLANNED на своей исходной дате. Без крона в проекте нет —
  // ловим это здесь, при первом заходе в кабинет за день: любая такая задача из
  // прошлого переезжает на сегодня и будет переезжать так каждый день дальше,
  // пока её не отметят выполненной (или явно не решат её судьбу в "Итоге дня").
  await prisma.task.updateMany({
    where: { userId: user.id, status: TaskStatus.PLANNED, date: { lt: todayDate() } },
    data: { date: todayDate() },
  });

  await syncDnevnikOverdueTask(user.id);

  const [projects, tasks, planTodayCount] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ACTIVE_STATUSES } },
      select: { projectId: true, status: true },
    }),
    // Бейдж у "План дня" в сайдбаре — сколько задач реально стоит в плане на
    // сегодня, а не весь бэклог+запланированное по всем датам (это была
    // путаница: цифра в сайдбаре не совпадала с тем, что видно на странице).
    prisma.task.count({ where: { userId: user.id, date: todayDate(), status: TaskStatus.PLANNED } }),
  ]);

  const projectNodes = projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId, priority: p.priority, color: p.color }));
  const byId = new Map(projectNodes.map((p) => [p.id, p]));

  // "Задачи" по умолчанию показывает весь активный объём (бэклог + то, что уже
  // стоит в каком-то дне) — счётчики в шапке считают то же самое, чтобы бейдж
  // совпадал с тем, что откроется по клику.
  const ownCounts: Record<string, number> = {};
  let noProjectCount = 0;
  for (const t of tasks) {
    if (!t.projectId) {
      noProjectCount++;
      continue;
    }
    ownCounts[t.projectId] = (ownCounts[t.projectId] ?? 0) + 1;
  }

  // Счётчик верхнего проекта включает задачи всех его подпроектов.
  const counts: Record<string, number> = { ...ownCounts };
  for (const p of projectNodes) {
    if (p.parentId && byId.has(p.parentId)) {
      counts[p.parentId] = (counts[p.parentId] ?? 0) + (ownCounts[p.id] ?? 0);
    }
  }

  return (
    <AppShell
      projects={projectNodes}
      counts={counts}
      noProjectCount={noProjectCount}
      totalCount={planTodayCount}
      cabinetName={user.name}
    >
      {children}
    </AppShell>
  );
}
