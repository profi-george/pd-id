import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, addDays, sameDate, formatDateHuman, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { formatEffort } from "@/lib/priorityEngine";
import PriorityMatrix from "@/components/PriorityMatrix";
import { requireUser } from "@/lib/auth";
import { getGoogleStatus } from "@/app/(app)/actions";

export const dynamic = "force-dynamic";

// Дневной лимит для предупреждения о перегрузке плана — ориентир, не жёсткое ограничение.
const DAILY_CAPACITY_MINUTES = 6 * 60;

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const user = await requireUser();
  const { date: dateParam } = await searchParams;
  const today = todayDate();
  const date = dateParam ? parseDateInputValue(dateParam) : today;
  const isToday = sameDate(date, today);
  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  const [day, dayTasks, projects, googleStatus] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.task.findMany({
      where: { userId: user.id, date },
      include: { project: true },
      orderBy: { order: "asc" },
    }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    getGoogleStatus(),
  ]);

  // "План дня" — единый редактируемый список ВСЕХ задач этого дня (любого статуса),
  // а не живой план + отдельный нередактируемый список "что случилось". Статус —
  // это просто отметка на строке, а не другое место в интерфейсе.
  const planned = dayTasks.filter((t) => t.status === TaskStatus.PLANNED);
  const matrixTasks = dayTasks.map((t) => ({ ...t, projectName: t.project?.name ?? null }));
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  // Перегрузка считается по тому, что ещё реально предстоит сделать — не по всему дню.
  const totalMinutes = planned.reduce((sum, t) => sum + t.effortMinutes, 0);
  const overloaded = totalMinutes > DAILY_CAPACITY_MINUTES;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">План дня</h1>
          <p className="text-sm text-neutral-500">{formatDateHuman(date)}</p>
          {planned.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5">
              {planned.length} задач · ≈{formatEffort(totalMinutes)}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm shrink-0">
          <Link
            href={`/today?date=${toDateInputValue(prevDate)}`}
            className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            ← Вчера
          </Link>
          {!isToday && (
            <Link href="/today" className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600">
              Сегодня
            </Link>
          )}
          <Link
            href={`/today?date=${toDateInputValue(nextDate)}`}
            className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            Завтра →
          </Link>
        </div>
      </div>

      {day && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-800">
          Итог дня подведён. Трудность {day.difficulty} · настроение {day.mood} · эффективность{" "}
          {day.efficiency} · переживания {day.worry}
          {day.whyWorked && <p className="mt-1 text-emerald-900">Что получилось: {day.whyWorked}</p>}
          {day.whyNotWorked && <p className="mt-1 text-emerald-900">Что не получилось: {day.whyNotWorked}</p>}
          {day.conclusion ? <p className="mt-1 text-emerald-900">Вывод на завтра: {day.conclusion}</p> : null}
          <Link href={`/today/summary?date=${toDateInputValue(date)}`} className="inline-block mt-1.5 underline hover:text-emerald-900">
            Изменить итог →
          </Link>
        </div>
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

      {overloaded && (
        <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          В плане ≈{formatEffort(totalMinutes)} задач — это больше, чем обычно помещается в день.
          Возможно, стоит перенести часть на другой день.
        </p>
      )}

      {/* Один список на весь день — все статусы вместе, каждый со своей пометкой
          в строке. Не прячем его, даже если итог дня уже подведён: иначе новая
          задача, добавленная на "закрытый" день, была бы не видна нигде. */}
      <PriorityMatrix
        tasks={matrixTasks}
        projectOptions={projectOptions}
        googleConnected={googleStatus.connected}
        planView
      />

      {dayTasks.length > 0 && !day && (
        <Link
          href={`/today/summary?date=${toDateInputValue(date)}`}
          className="inline-block text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
        >
          Подвести итог дня
        </Link>
      )}

      <p className="text-xs text-neutral-400">
        <Link href="/history" className="underline hover:text-neutral-600">
          Все дни →
        </Link>
      </p>
    </div>
  );
}
