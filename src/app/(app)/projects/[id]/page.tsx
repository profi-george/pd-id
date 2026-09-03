import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import { getGoogleStatus } from "@/app/(app)/actions";
import { flattenProjectsForSelect, projectAndDescendantIds } from "@/lib/projectTree";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const [project, allProjects, tasks, googleStatus] = await Promise.all([
    prisma.project.findFirst({ where: { id, userId: user.id } }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { userId: user.id, status: { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] } },
      include: { project: true, subtasks: { orderBy: { order: "asc" } } },
    }),
    getGoogleStatus(),
  ]);

  if (!project) notFound();

  const projectNodes = allProjects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const scopeIds = projectAndDescendantIds(id, projectNodes);
  const scopedTasks = tasks
    .filter((t) => t.projectId && scopeIds.has(t.projectId))
    .map((t) => ({ ...t, projectName: t.project?.name ?? null, projectPriority: t.project?.priority ?? null }));

  const projectOptions = flattenProjectsForSelect(projectNodes);

  return (
    <div className="space-y-6">
      {/* Переключатель между всеми проектами — текущий выделен тёмной пилюлей,
          остальные обычным текстом, клик сразу переходит на другой проект. */}
      <div className="flex items-center gap-1 flex-wrap">
        {allProjects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              p.id === project.id
                ? "bg-neutral-900 text-white"
                : "text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100"
            }`}
          >
            {p.name}
          </Link>
        ))}
      </div>
      <div>
        <h1 className="text-xl font-display font-bold">{project.name}</h1>
        <p className="text-sm text-neutral-500">{scopedTasks.length} задач</p>
      </div>
      <PriorityMatrix
        tasks={scopedTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        emptyMessage="В этом проекте пока нет задач."
      />
    </div>
  );
}
