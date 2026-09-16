import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, sameDate, formatDateHumanFull, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { tasksWord } from "@/lib/pluralize";
import PriorityMatrix from "@/components/PriorityMatrix";
import LayoutToggle from "@/components/LayoutToggle";
import DayDateNav from "@/components/DayDateNav";
import { IconArrowRight, IconCheck, IconPlus } from "@/components/icons";
import { requireUser } from "@/lib/auth";
import { getGoogleStatus, getCycleSettings, completeTask } from "@/app/(app)/actions";
import { getCycleInfo, getCycleNote } from "@/lib/cycle";

export const dynamic = "force-dynamic";

// "Задачи" и "План дня" были двумя разными экранами с частично одинаковым
// списком — теперь один экран с двумя режимами (?view=day|all), а не два
// отдельных пункта навигации с дублирующимся содержимым.
function ViewToggle({ mode, date }: { mode: "day" | "all"; date: Date }) {
  const dayHref = `/today?date=${toDateInputValue(date)}`;
  const allHref = "/today?view=all";
  return (
    <div className="segmented shrink-0">
      <Link href={dayHref} className="segment" data-active={mode === "day"}>
        План дня
      </Link>
      <Link href={allHref} className="segment" data-active={mode === "all"}>
        Все задачи
      </Link>
    </div>
  );
}

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; view?: string; project?: string; complete?: string; layout?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam, view, project: projectFilter, complete, layout: layoutParam } = await searchParams;
  const layout: "list" | "grid" = layoutParam === "grid" ? "grid" : "list";

  // Диплинк из Дневника («Отметить задачу выполненной в ПД-ИД») — отмечаем и сразу
  // убираем ?complete из адреса, чтобы обновление страницы не повторяло действие.
  if (complete) {
    await completeTask(complete);
    const params = new URLSearchParams();
    if (dateParam) params.set("date", dateParam);
    if (view) params.set("view", view);
    if (projectFilter) params.set("project", projectFilter);
    if (layoutParam) params.set("layout", layoutParam);
    const qs = params.toString();
    redirect(qs ? `/today?${qs}` : "/today");
  }

  const mode: "day" | "all" = view === "all" ? "all" : "day";
  const today = todayDate();
  const date = dateParam ? parseDateInputValue(dateParam) : today;

  if (mode === "all") {
    const [tasks, projects, googleStatus] = await Promise.all([
      // «Все задачи» — весь объём, вкладки Предстоит/Выполнено фильтруют на
      // клиенте (см. statusTabs в PriorityMatrix), поэтому статус здесь не
      // ограничиваем.
      prisma.task.findMany({
        where: { userId: user.id },
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
      projectColor: t.project?.color ?? null,
    }));
    const projectOptions = flattenProjectsForSelect(
      projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId, color: p.color }))
    );

    function allLayoutHref(l: "list" | "grid") {
      const params = new URLSearchParams();
      params.set("view", "all");
      if (projectFilter) params.set("project", projectFilter);
      if (l === "grid") params.set("layout", "grid");
      return `/today?${params.toString()}`;
    }

    return (
      <div className="space-y-7">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">
              {projectFilter === "none" ? "Без проекта" : "Все задачи"}
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              <span className="tabular-nums font-medium text-neutral-700">{matrixTasks.length}</span>{" "}
              {tasksWord(matrixTasks.length)} · отсортированы по приоритету
            </p>
          </div>
          <div className="flex flex-col items-end gap-2 shrink-0">
            <ViewToggle mode="all" date={today} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <Link href="/add" className="btn btn-secondary btn-sm">
            <IconPlus size={13} />
            Добавить задачу
          </Link>
          <LayoutToggle layout={layout} hrefFor={allLayoutHref} />
        </div>

        <PriorityMatrix
          tasks={matrixTasks}
          projectOptions={projectOptions}
          googleConnected={googleStatus.connected}
          statusTabs
          viewMode={layout}
          emptyMessage={
            projectFilter === "none"
              ? "В задачах без проекта пока пусто."
              : "Пока нет незапланированных задач — опишите новую мысль в «Добавить AI»."
          }
        />
      </div>
    );
  }

  // mode === "day"
  const isToday = sameDate(date, today);
  const [day, dayTasks, projects, googleStatus, cycleSettings] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.task.findMany({
      where: { userId: user.id, date },
      include: { project: true, subtasks: { orderBy: { order: "asc" } } },
      orderBy: { order: "asc" },
    }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getGoogleStatus(),
    getCycleSettings(),
  ]);

  // Ненавязчивый бейдж сбоку — только если дата начала цикла вообще задана
  // в настройках, иначе просто не показываем ничего.
  const cycleInfo = cycleSettings.cycleStartDate
    ? getCycleInfo(cycleSettings.cycleStartDate, date, cycleSettings.cycleLengthDays ?? undefined, cycleSettings.periodLengthDays ?? undefined)
    : null;

  const isPast = date.getTime() < today.getTime();
  const planned = dayTasks.filter((t) => t.status === TaskStatus.PLANNED);
  // Для прогресса рядом с "Подвести итог дня" — переносы (MOVED) не в счёт,
  // это уже не часть плана этого дня.
  const doneCount = dayTasks.filter((t) => t.status === TaskStatus.DONE).length;
  const totalForDay = dayTasks.filter((t) => t.status !== TaskStatus.MOVED).length;
  // Показываем весь план дня, а не только ещё не сделанное — отмеченные DONE
  // задачи должны оставаться видны (с галочкой), а не пропадать при обновлении
  // страницы. Раньше это было верно только для прошедших дней.
  const matrixTasks = dayTasks.map((t) => ({
    ...t,
    projectName: t.project?.name ?? null,
    projectPriority: t.project?.priority ?? null,
    projectColor: t.project?.color ?? null,
  }));
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId, color: p.color }))
  );

  function dayLayoutHref(l: "list" | "grid") {
    const params = new URLSearchParams();
    if (dateParam) params.set("date", dateParam);
    if (l === "grid") params.set("layout", "grid");
    const qs = params.toString();
    return qs ? `/today?${qs}` : "/today";
  }

  const donePercent = totalForDay > 0 ? Math.round((doneCount / totalForDay) * 100) : 0;

  return (
    <div className="space-y-7">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">
              {isToday ? "Сегодня" : "План дня"}
            </h1>
            {planned.length > 0 && (
              <span className="text-[11px] font-semibold px-2 py-1 rounded-md bg-ink-50 text-ink-700 tabular-nums shrink-0">
                {planned.length} {tasksWord(planned.length)}
              </span>
            )}
          </div>
          <p className="text-sm text-neutral-500 mt-1 first-letter:uppercase">{formatDateHumanFull(date)}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <ViewToggle mode="day" date={date} />
          <DayDateNav date={date} isToday={isToday} todayISO={toDateInputValue(today)} />
          {cycleInfo && (
            <div className="max-w-[13rem] rounded-xl bg-rose-50 ring-1 ring-rose-100 px-3 py-2 text-right">
              <Link
                href="/settings"
                title="Настроить в Настройках"
                className="text-[11px] font-semibold text-rose-700 hover:text-rose-800 whitespace-nowrap"
              >
                День цикла {cycleInfo.day} · {cycleInfo.phaseLabel}
              </Link>
              <p className="text-[11px] text-rose-500/80 leading-snug mt-0.5">
                {getCycleNote(cycleInfo, cycleSettings.cycleLengthDays ?? undefined)}
              </p>
            </div>
          )}
        </div>
      </div>

      {day ? (
        <div className="rounded-xl bg-emerald-50 ring-1 ring-emerald-200 px-4 py-3 text-sm text-emerald-900">
          <p className="flex items-center gap-2 font-medium">
            <IconCheck size={15} className="shrink-0 text-emerald-600" />
            Итог дня подведён
          </p>
          {/* Метрики — сеткой из отдельных значений, а не одной строкой через
              «·»: так число и его подпись читаются парой, и строка не рвётся
              по середине пары на узком экране. */}
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 mt-2.5 pt-2.5 border-t border-emerald-200/70">
            {([
              ["Трудность", day.difficulty],
              ["Настроение", day.mood],
              ["Эффективность", day.efficiency],
              ["Переживания", day.worry],
            ] as const).map(([label, value]) => (
              <div key={label}>
                <dt className="text-[10px] uppercase tracking-[0.06em] text-emerald-700/70">{label}</dt>
                <dd className="text-base font-semibold tabular-nums text-emerald-900 leading-tight">
                  {value ?? "—"}
                  <span className="text-[11px] font-normal text-emerald-700/60">/10</span>
                </dd>
              </div>
            ))}
          </dl>
          {(day.hasPms || day.hadConflict) && (
            <div className="flex flex-wrap gap-1.5 mt-2.5">
              {day.hasPms && <span className="chip bg-emerald-100/70 text-emerald-800">ПМС</span>}
              {day.hadConflict && <span className="chip bg-emerald-100/70 text-emerald-800">был конфликт</span>}
            </div>
          )}
          {day.whyWorked && <p className="mt-2.5 leading-relaxed">Заберу из дня: {day.whyWorked}</p>}
          {day.conclusion ? <p className="mt-1 leading-relaxed">Вывод на завтра: {day.conclusion}</p> : null}
          <Link
            href={`/today/summary?date=${toDateInputValue(date)}`}
            className="inline-flex items-center gap-1 mt-3 font-medium underline underline-offset-2 hover:text-emerald-700 transition-colors"
          >
            Изменить итог
            <IconArrowRight size={13} />
          </Link>
        </div>
      ) : (
        dayTasks.length > 0 && (
          <div className="surface flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-neutral-600">
                <span className="font-semibold text-neutral-900 tabular-nums">{doneCount}</span>
                <span className="text-neutral-400 tabular-nums">/{totalForDay}</span> выполнено
              </p>
              {/* Полоса прогресса вместо одной цифры: положение дня видно
                  боковым зрением, без чтения. */}
              <div className="mt-2 h-1.5 rounded-full bg-neutral-100 overflow-hidden" role="presentation">
                <div
                  className="h-full rounded-full bg-ink-500 transition-[width] duration-500"
                  style={{ width: `${donePercent}%` }}
                />
              </div>
            </div>
            <Link href={`/today/summary?date=${toDateInputValue(date)}`} className="btn btn-primary shrink-0">
              Подвести итог дня
            </Link>
          </div>
        )
      )}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm font-semibold text-neutral-800 tracking-[-0.01em]">
          {isToday ? "Что важно сделать сегодня" : "Что важно сделать"}
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <LayoutToggle layout={layout} hrefFor={dayLayoutHref} />
          <Link href="/add" className="btn btn-secondary btn-sm">
            <IconPlus size={13} />
            Добавить задачу
          </Link>
        </div>
      </div>

      {/* Весь день целиком передаётся в PriorityMatrix — вкладки Предстоит/
          Выполнено фильтруют на клиенте, без похода на сервер при переключении. */}
      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        planView
        showTopPick={!isPast}
        statusTabs
        viewMode={layout}
        emptyMessage={
          isToday
            ? "На сегодня пока пусто — хороший повод решить, что сделать в первую очередь."
            : "На этот день пока ничего не запланировано."
        }
      />

      <Link
        href="/history"
        className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 transition-colors"
      >
        Все дни
        <IconArrowRight size={12} />
      </Link>
    </div>
  );
}
