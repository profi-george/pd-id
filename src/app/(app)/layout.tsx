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
      select: { projectId: true },
    }),
  ]);

  const projectNodes = projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const byId = new Map(projectNodes.map((p) => [p.id, p]));

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
      totalCount={tasks.length}
      cabinetName={user.name}
    >
      {children}
    </AppShell>
  );
}
