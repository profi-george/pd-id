import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import AppShell from "@/components/AppShell";

const ACTIVE_STATUSES = [TaskStatus.BACKLOG, TaskStatus.PLANNED];

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: ACTIVE_STATUSES } },
      select: { projectId: true, status: true },
    }),
  ]);

  const projectNodes = projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const byId = new Map(projectNodes.map((p) => [p.id, p]));

  // Счётчик у проекта в дереве — весь активный объём (и в бэклоге, и уже в плане),
  // это общая "сколько ещё висит на проекте". А вот "Задачи"/"Без проекта" в шапке —
  // это именно Бэклог (нераспределённые), поэтому считаются только по BACKLOG-статусу,
  // чтобы бейдж совпадал с тем, что реально покажет открытая страница.
  const ownCounts: Record<string, number> = {};
  let noProjectCount = 0;
  let backlogCount = 0;
  for (const t of tasks) {
    if (t.status === TaskStatus.BACKLOG) {
      backlogCount++;
      if (!t.projectId) noProjectCount++;
    }
    if (!t.projectId) continue;
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
      totalCount={backlogCount}
      cabinetName={user.name}
    >
      {children}
    </AppShell>
  );
}
