import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import { getGoogleStatus } from "@/app/actions";
import { flattenProjectsForSelect, projectAndDescendantIds } from "@/lib/projectTree";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [project, allProjects, tasks, googleStatus] = await Promise.all([
    prisma.project.findUnique({ where: { id } }),
    prisma.project.findMany(),
    prisma.task.findMany({
      where: { status: { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] } },
      include: { project: true },
    }),
    getGoogleStatus(),
  ]);

  if (!project) notFound();

  const projectNodes = allProjects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const scopeIds = projectAndDescendantIds(id, projectNodes);
  const scopedTasks = tasks
    .filter((t) => t.projectId && scopeIds.has(t.projectId))
    .map((t) => ({ ...t, projectName: t.project?.name ?? null }));

  const projectOptions = flattenProjectsForSelect(projectNodes);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{project.name}</h1>
        <p className="text-sm text-neutral-500">{scopedTasks.length} задач</p>
      </div>
      <PriorityMatrix
        tasks={scopedTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
      />
    </div>
  );
}
