import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import { getGoogleStatus } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const user = await requireUser();
  const { project: projectFilter } = await searchParams;

  const [tasks, projects, googleStatus] = await Promise.all([
    prisma.task.findMany({
      where: { userId: user.id, status: { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] } },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getGoogleStatus(),
  ]);

  const filtered =
    projectFilter === "none"
      ? tasks.filter((t) => !t.projectId)
      : tasks;

  const matrixTasks = filtered.map((t) => ({
    ...t,
    projectName: t.project?.name ?? null,
  }));

  const projectNodes = projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const projectOptions = flattenProjectsForSelect(projectNodes);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {projectFilter === "none" ? "Без проекта" : "Задачи"}
          </h1>
          <p className="text-sm text-neutral-500">
            {matrixTasks.length} задач{projectFilter !== "none" ? " · отсортированы по приоритету" : ""}
          </p>
        </div>
        <Link
          href="/add"
          className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 shrink-0"
        >
          + Добавить задачу
        </Link>
      </div>

      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
      />
    </div>
  );
}
