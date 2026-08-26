import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, addDays, sameDate, formatDateHuman, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { tasksWord } from "@/lib/pluralize";
import PriorityMatrix from "@/components/PriorityMatrix";
import { requireUser } from "@/lib/auth";
import { getGoogleStatus } from "@/app/(app)/actions";

export const dynamic = "force-dynamic";

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

  // "План дня" на сегодня/будущее показывает только активные задачи — то, что ЕЩЁ
  // предстоит. Но для прошедшего дня "активных" уже почти никогда нет (всё решено) —
  // там план без исхода был бы пустым и бесполезным, поэтому там показываем всё,
  // что было в этот день, с пометкой статуса на каждой строке.
  const isPast = date.getTime() < today.getTime();
  const planned = dayTasks.filter((t) => t.status === TaskStatus.PLANNED);
  const matrixTasks = (isPast ? dayTasks : planned).map((t) => ({ ...t, projectName: t.project?.name ?? null }));
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">План дня</h1>
          <p className="text-sm text-neutral-500">{formatDateHuman(date)}</p>
          {planned.length > 0 && (
            <p className="text-xs text-neutral-400 mt-0.5">
              {planned.length} {tasksWord(planned.length)}
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

      {day ? (
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
      />

      <p className="text-xs text-neutral-400">
        <Link href="/history" className="underline hover:text-neutral-600">
          Все дни →
        </Link>
      </p>
    </div>
  );
}
