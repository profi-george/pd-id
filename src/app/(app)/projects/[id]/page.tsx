import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import LayoutToggle from "@/components/LayoutToggle";
import { getGoogleStatus } from "@/app/(app)/actions";
import { flattenProjectsForSelect, projectAndDescendantIds } from "@/lib/projectTree";
import { requireUser } from "@/lib/auth";
import { tasksWord } from "@/lib/pluralize";

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ layout?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { layout: layoutParam } = await searchParams;
  const layout: "list" | "grid" = layoutParam === "grid" ? "grid" : "list";

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

  const projectNodes = allProjects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId, color: p.color }));
  const scopeIds = projectAndDescendantIds(id, projectNodes);
  const scopedTasks = tasks
    .filter((t) => t.projectId && scopeIds.has(t.projectId))
    .map((t) => ({
      ...t,
      projectName: t.project?.name ?? null,
      projectPriority: t.project?.priority ?? null,
      projectColor: t.project?.color ?? null,
    }));

  const projectOptions = flattenProjectsForSelect(projectNodes);

  return (
    <div className="space-y-7">
      {/* Переключатель между всеми проектами — текущий выделен пилюлей в цвете
          проекта, остальные обычным текстом, клик сразу переходит на другой
          проект. У неактивных появилась точка цвета: раньше цвет проекта был
          виден только когда он и так открыт, то есть ровно тогда, когда искать
          его уже не нужно. Горизонтальная прокрутка вместо переноса — при
          десятке проектов две-три строки пилюль съедали весь первый экран. */}
      <div className="flex items-center gap-1 overflow-x-auto -mx-4 px-4 sm:-mx-6 sm:px-6 pb-1">
        {allProjects.map((p) => {
          const active = p.id === project.id;
          return (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium whitespace-nowrap shrink-0 transition-colors ${
                active
                  ? "text-white shadow-xs"
                  : "text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100"
              }`}
              style={active ? { backgroundColor: p.color ?? "var(--color-neutral-900)" } : undefined}
            >
              {!active && p.color && (
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
              )}
              {p.name}
            </Link>
          );
        })}
      </div>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="flex items-center gap-2.5 text-[26px] leading-tight font-display font-bold text-neutral-900">
            {project.color && (
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: project.color }} />
            )}
            {project.name}
          </h1>
          <p className="text-sm text-neutral-500 mt-1">
            <span className="tabular-nums font-medium text-neutral-700">{scopedTasks.length}</span>{" "}
            {tasksWord(scopedTasks.length)}
          </p>
        </div>
        <LayoutToggle
          layout={layout}
          hrefFor={(l) => (l === "grid" ? `/projects/${id}?layout=grid` : `/projects/${id}`)}
        />
      </div>
      <PriorityMatrix
        tasks={scopedTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        viewMode={layout}
        emptyMessage="В этом проекте пока нет задач."
      />
    </div>
  );
}
