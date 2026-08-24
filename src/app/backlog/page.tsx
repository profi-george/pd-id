import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import UnifiedTaskInput from "@/components/UnifiedTaskInput";
import { getGoogleStatus } from "@/app/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";

export const dynamic = "force-dynamic";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string }>;
}) {
  const { project: projectFilter } = await searchParams;

  const [tasks, projects, googleStatus] = await Promise.all([
    prisma.task.findMany({
      where: { status: { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] } },
      include: { project: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
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
      <div>
        <h1 className="text-xl font-semibold">
          {projectFilter === "none" ? "Без проекта" : "Все задачи"}
        </h1>
        <p className="text-sm text-neutral-500">
          {matrixTasks.length} задач{projectFilter !== "none" ? " · отсортированы по приоритету" : ""}
        </p>
      </div>

      {projectFilter !== "none" && <UnifiedTaskInput projects={projectOptions} />}

      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
      />
    </div>
  );
}
