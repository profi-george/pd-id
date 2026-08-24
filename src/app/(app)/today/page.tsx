import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, tomorrowDate, formatDateHuman } from "@/lib/dates";
import { reorderTasks, deleteTask } from "@/app/(app)/actions";
import TaskReorderList from "@/components/TaskReorderList";
import PriorityTag from "@/components/PriorityTag";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STATUS_LABEL: Record<string, string> = {
  DONE: "Выполнена",
  MOVED: "Перенесена на завтра",
  NOT_DONE: "Не выполнена",
};

export default async function TodayPage() {
  const user = await requireUser();
  const date = todayDate();
  const tomorrow = tomorrowDate();

  const [day, todayTasksAll, tomorrowTasks] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    prisma.task.findMany({
      where: { userId: user.id, date },
      include: { project: true },
      orderBy: { order: "asc" },
    }),
    prisma.task.findMany({
      where: { userId: user.id, date: tomorrow },
      include: { project: true },
      orderBy: { order: "asc" },
    }),
  ]);

  const plannedToday = todayTasksAll.filter((t) => t.status === TaskStatus.PLANNED);
  const finishedToday = todayTasksAll.filter((t) => t.status !== TaskStatus.PLANNED);

  const toDTO = (t: (typeof todayTasksAll)[number]) => ({
    ...t,
    projectName: t.project?.name ?? null,
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold">Сегодня</h1>
        <p className="text-sm text-neutral-500">{formatDateHuman(date)}</p>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-600">План на сегодня</h2>
          <Link
            href="/tasks/new?date=today"
            className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            + Добавить задачу
          </Link>
        </div>

        {!day ? (
          <>
            <TaskReorderList
              tasks={plannedToday.map(toDTO)}
              reorderAction={reorderTasks}
              deleteAction={deleteTask}
              emptyText="На сегодня пока ничего не запланировано."
            />
            <Link
              href="/today/summary"
              className="inline-block text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
            >
              Подвести итог дня
            </Link>
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm text-green-800">
              Итог дня подведён. Трудность {day.difficulty} · настроение {day.mood} · эффективность{" "}
              {day.efficiency} · переживания {day.worry}
              {day.conclusion ? (
                <p className="mt-1 text-green-900">Вывод на завтра: {day.conclusion}</p>
              ) : null}
            </div>
            <ul className="space-y-2">
              {finishedToday.map((t) => (
                <li
                  key={t.id}
                  className="bg-white border border-neutral-200 rounded-lg px-3 py-2 flex items-center gap-3"
                >
                  <div className="flex-1 space-y-1">
                    <p className="text-sm">{t.text}</p>
                    <div className="flex items-center gap-2 text-xs text-neutral-500">
                      <PriorityTag task={t} />
                      <span>{STATUS_LABEL[t.status] ?? t.status}</span>
                      {t.score !== null ? <span>· оценка {t.score}/10</span> : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-neutral-600">Черновик на завтра</h2>
          <Link
            href="/tasks/new?date=tomorrow"
            className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            + Добавить задачу
          </Link>
        </div>
        <TaskReorderList
          tasks={tomorrowTasks.map(toDTO)}
          reorderAction={reorderTasks}
          deleteAction={deleteTask}
          emptyText="Черновик пока пуст."
        />
      </section>
    </div>
  );
}
