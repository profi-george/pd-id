import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, addDays, sameDate, formatDateHuman, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { formatEffort } from "@/lib/priorityEngine";
import PriorityMatrix from "@/components/PriorityMatrix";
import PriorityTag from "@/components/PriorityTag";
import { requireUser } from "@/lib/auth";
import { getGoogleStatus } from "@/app/(app)/actions";

export const dynamic = "force-dynamic";

// Дневной лимит для предупреждения о перегрузке плана — ориентир, не жёсткое ограничение.
const DAILY_CAPACITY_MINUTES = 6 * 60;

const STATUS_LABEL: Record<string, string> = {
  DONE: "Выполнена",
  MOVED: "Перенесена на завтра",
  NOT_DONE: "Не выполнена",
};

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

  const planned = dayTasks.filter((t) => t.status === TaskStatus.PLANNED);
  const finished = dayTasks.filter((t) => t.status !== TaskStatus.PLANNED);

  const matrixTasks = planned.map((t) => ({ ...t, projectName: t.project?.name ?? null }));
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

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

      {!day ? (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-neutral-600">Что важно сделать сегодня</p>
            {isToday && (
              <Link
                href="/tasks/new?date=today"
                className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
              >
                + Добавить задачу
              </Link>
            )}
          </div>

          {overloaded && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              В плане ≈{formatEffort(totalMinutes)} задач — это больше, чем обычно помещается в день.
              Возможно, стоит перенести часть на другой день.
            </p>
          )}

          <PriorityMatrix
            tasks={matrixTasks}
            projectOptions={projectOptions}
            googleConnected={googleStatus.connected}
            planView
          />

          {planned.length > 0 && (
            <Link
              href={`/today/summary?date=${toDateInputValue(date)}`}
              className="inline-block text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
            >
              Подвести итог дня
            </Link>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
            Итог дня подведён. Трудность {day.difficulty} · настроение {day.mood} · эффективность{" "}
            {day.efficiency} · переживания {day.worry}
            {day.conclusion ? <p className="mt-1 text-green-900">Вывод на завтра: {day.conclusion}</p> : null}
          </div>
          <ul className="space-y-2">
            {finished.map((t) => (
              <li key={t.id} className="bg-white border border-neutral-200 rounded-lg px-3 py-2 flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <p className="text-sm">{t.text}</p>
                  <div className="flex items-center gap-2 text-xs text-neutral-500">
                    <PriorityTag task={t} />
                    <span>{STATUS_LABEL[t.status] ?? t.status}</span>
                    {t.score !== null ? <span>· результат {t.score}/10</span> : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="text-xs text-neutral-400">
        <Link href="/history" className="underline hover:text-neutral-600">
          Все дни →
        </Link>
      </p>
    </div>
  );
}
