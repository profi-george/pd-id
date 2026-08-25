import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import PriorityMatrix from "@/components/PriorityMatrix";
import { getGoogleStatus } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { tasksWord } from "@/lib/pluralize";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BacklogPage({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; filter?: string }>;
}) {
  const user = await requireUser();
  const { project: projectFilter, filter } = await searchParams;
  const undatedOnly = filter === "undated";

  const [tasks, projects, googleStatus] = await Promise.all([
    // «Задачи» — по умолчанию весь активный объём (и нераспределённое, и уже
    // стоящее в каком-то дне), одним списком по приоритету — чтобы видеть всё
    // сразу. «Только нераспределённые» — это фильтр внутри той же страницы,
    // а не отдельный раздел навигации.
    prisma.task.findMany({
      where: {
        userId: user.id,
        status: undatedOnly ? TaskStatus.BACKLOG : { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] },
      },
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

  function hrefFor(mode: "all" | "undated") {
    const params = new URLSearchParams();
    if (projectFilter) params.set("project", projectFilter);
    if (mode === "undated") params.set("filter", "undated");
    const qs = params.toString();
    return `/backlog${qs ? `?${qs}` : ""}`;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">
            {projectFilter === "none" ? "Без проекта" : "Задачи"}
          </h1>
          <p className="text-sm text-neutral-500">
            {matrixTasks.length} {tasksWord(matrixTasks.length)}
            {undatedOnly ? " · нераспределённые" : ""} · отсортированы по приоритету
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden text-xs">
            <Link
              href={hrefFor("all")}
              className={`px-2.5 py-1 ${undatedOnly ? "text-neutral-500 hover:bg-neutral-50" : "bg-neutral-800 text-white"}`}
            >
              Все
            </Link>
            <Link
              href={hrefFor("undated")}
              className={`px-2.5 py-1 border-l border-neutral-300 ${undatedOnly ? "bg-neutral-800 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}
            >
              Нераспределённые
            </Link>
          </div>
          <Link
            href="/add"
            className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            + Добавить задачу
          </Link>
        </div>
      </div>

      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        removeOnSchedule={undatedOnly}
      />
    </div>
  );
}
