import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, sameDate, formatDateHuman, formatDateHumanFull, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { tasksWord } from "@/lib/pluralize";
import PriorityMatrix from "@/components/PriorityMatrix";
import DayDateNav from "@/components/DayDateNav";
import { requireUser } from "@/lib/auth";
import { getGoogleStatus } from "@/app/(app)/actions";

export const dynamic = "force-dynamic";

// "Задачи" и "План дня" были двумя разными экранами с частично одинаковым
// списком — теперь один экран с двумя режимами (?view=day|all), а не два
// отдельных пункта навигации с дублирующимся содержимым.
function ViewToggle({ mode, date }: { mode: "day" | "all"; date: Date }) {
  const dayHref = `/today?date=${toDateInputValue(date)}`;
  const allHref = "/today?view=all";
  return (
    <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden text-xs shrink-0">
      <Link href={dayHref} className={`px-2.5 py-1 ${mode === "day" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
        План дня
      </Link>
      <Link href={allHref} className={`px-2.5 py-1 border-l border-neutral-300 ${mode === "all" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
        Все задачи
      </Link>
    </div>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; project?: string; filter?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam, view, project: projectFilter, filter } = await searchParams;
  const mode: "day" | "all" = view === "all" ? "all" : "day";
  const today = todayDate();
  const date = dateParam ? parseDateInputValue(dateParam) : today;

  if (mode === "all") {
    const undatedOnly = filter === "undated";
    const [tasks, projects, googleStatus] = await Promise.all([
      // «Все задачи» — по умолчанию весь активный объём (и нераспределённое, и уже
      // стоящее в каком-то дне), одним списком по приоритету. «Только нераспределённые» —
      // фильтр внутри того же режима, а не отдельный экран.
      prisma.task.findMany({
        where: {
          userId: user.id,
          status: undatedOnly ? TaskStatus.BACKLOG : { in: [TaskStatus.BACKLOG, TaskStatus.PLANNED] },
        },
        include: { project: true, subtasks: { orderBy: { order: "asc" } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
      getGoogleStatus(),
    ]);

    const filtered = projectFilter === "none" ? tasks.filter((t) => !t.projectId) : tasks;
    const matrixTasks = filtered.map((t) => ({
      ...t,
      projectName: t.project?.name ?? null,
      projectPriority: t.project?.priority ?? null,
    }));
    const projectOptions = flattenProjectsForSelect(projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId })));

    function hrefFor(filterMode: "all" | "undated") {
      const params = new URLSearchParams();
      params.set("view", "all");
      if (projectFilter) params.set("project", projectFilter);
      if (filterMode === "undated") params.set("filter", "undated");
      return `/today?${params.toString()}`;
    }

    return (
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h1 className="text-xl font-display font-bold">
              {projectFilter === "none" ? "Без проекта" : "Все задачи"}
            </h1>
            <p className="text-sm text-neutral-500">
              {matrixTasks.length} {tasksWord(matrixTasks.length)}
              {undatedOnly ? " · нераспределённые" : ""} · отсортированы по приоритету
            </p>
          </div>
          <ViewToggle mode="all" date={today} />
        </div>

        <div className="flex items-center gap-2">
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
          <Link href="/add" className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50">
            + Добавить задачу
          </Link>
        </div>

        <PriorityMatrix
          tasks={matrixTasks}
          projectOptions={projectOptions}
          googleConnected={googleStatus.connected}
          removeOnSchedule={undatedOnly}
          emptyMessage={
            undatedOnly
              ? "Все задачи уже привязаны к дате."
              : projectFilter === "none"
              ? "В задачах без проекта пока пусто."
              : "Пока нет незапланированных задач — опишите новую мысль в «Добавить AI»."
          }
        />
      </div>
    );
  }

  // mode === "day"
  const isToday = sameDate(date, today);
  const [day, dayTasks, projects, googleStatus] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.task.findMany({
      where: { userId: user.id, date },
      include: { project: true, subtasks: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getGoogleStatus(),
  ]);

  // "План дня" на сегодня/будущее показывает только активные задачи — то, что ЕЩЁ
  // предстоит. Но для прошедшего дня "активных" уже почти никогда нет (всё решено) —
  // там план без исхода был бы пустым и бесполезным, поэтому там показываем всё,
  // что было в этот день, с пометкой статуса на каждой строке.
  const isPast = date.getTime() < today.getTime();
  const planned = dayTasks.filter((t) => t.status === TaskStatus.PLANNED);
  const matrixTasks = (isPast ? dayTasks : planned).map((t) => ({
    ...t,
    projectName: t.project?.name ?? null,
    projectPriority: t.project?.priority ?? null,
  }));
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">
            {isToday ? "Сегодня" : "План дня"}
          </h1>
          <p className="text-sm text-neutral-500">{formatDateHumanFull(date)}</p>
          {planned.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5">
              {planned.length} {tasksWord(planned.length)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ViewToggle mode="day" date={date} />
          <DayDateNav date={date} isToday={isToday} todayISO={toDateInputValue(today)} />
        </div>
      </div>

      {day ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
          Итог дня подведён. Трудность {day.difficulty} · настроение {day.mood} · эффективность{" "}
          {day.efficiency} · переживания {day.worry}
          {day.cycleDay != null && <span> · день цикла {day.cycleDay}</span>}
          {day.hadConflict && <span> · был конфликт</span>}
          {day.whyWorked && <p className="mt-1 text-emerald-900">Что получилось: {day.whyWorked}</p>}
          {day.whyNotWorked && <p className="mt-1 text-emerald-900">Что не получилось: {day.whyNotWorked}</p>}
          {day.conclusion ? <p className="mt-1 text-emerald-900">Вывод на завтра: {day.conclusion}</p> : null}
          <Link href={`/today/summary?date=${toDateInputValue(date)}`} className="inline-block mt-1.5 underline hover:text-emerald-900">
            Изменить итог →
          </Link>
        </div>
      ) : (
        dayTasks.length > 0 && (
          <Link
            href={`/today/summary?date=${toDateInputValue(date)}`}
            className="inline-block text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
          >
            Подвести итог дня
          </Link>
        )
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-neutral-600">
          {isToday ? "Что важно сделать сегодня" : `План на ${formatDateHuman(date)}`}
        </p>
        <Link
          href="/add"
          className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
        >
          + Добавить задачу
        </Link>
      </div>

      {/* Только активные задачи. Не прячем список, даже если итог дня уже подведён:
          иначе новая задача, добавленная на "закрытый" день, была бы не видна нигде. */}
      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        planView
        showTopPick={!isPast}
        emptyMessage={
          isToday
            ? "На сегодня пока пусто — хороший повод решить, что сделать в первую очередь."
            : "На этот день пока ничего не запланировано."
        }
      />

      <p className="text-xs text-neutral-400">
        <Link href="/history" className="underline hover:text-neutral-600">
          Все дни →
        </Link>
      </p>
    </div>
  );
}
