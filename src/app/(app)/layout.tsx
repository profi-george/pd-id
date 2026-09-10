import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { todayDate } from "@/lib/dates";
import AppShell from "@/components/AppShell";

const ACTIVE_STATUSES = [TaskStatus.BACKLOG, TaskStatus.PLANNED];

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

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
