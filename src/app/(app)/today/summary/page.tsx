import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, addDays, sameDate, formatDateHuman, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { submitEveningForm, getCycleSettings } from "@/app/(app)/actions";
import { getCycleInfo } from "@/lib/cycle";
import EveningTaskRow from "@/components/EveningTaskRow";
import EveningSummaryCounter from "@/components/EveningSummaryCounter";
import UndoMoveButton from "@/components/UndoMoveButton";
import EveningSubmitButton from "@/components/EveningSubmitButton";
import DayContextFields from "@/components/DayContextFields";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function EveningSummaryPage({
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

  // Итог можно подводить/поправлять сколько угодно раз за день и после — не только
  // один раз вечером. Если итог уже был сохранён, подставляем прежние значения
  // (а не дефолты), чтобы повторное сохранение не затирало то, что уже было.
  const [existingDay, tasks, movedTasks, partialTasks, cycleSettings] = await Promise.all([
    prisma.day.findUnique({ where: { userId_date: { userId: user.id, date } } }),
    // Весь план этого дня — что ещё не отмечено (PLANNED), что уже отмечено
    // галочкой в течение дня (DONE), и что уже помечено невыполненным (NOT_DONE) —
    // всё это должно быть видно и оцениваемо здесь, а не только то, что осталось
    // "нетронутым" к вечеру.
    prisma.task.findMany({
      where: { userId: user.id, date, status: { in: [TaskStatus.PLANNED, TaskStatus.DONE, TaskStatus.NOT_DONE] } },
      include: { project: true },
      orderBy: { order: "asc" },
    }),
    // Убраны/перенесены мимо "Итога дня" в течение дня (кнопкой, а не тут) —
    // показываем как факт, без формы: тут уже нечего заполнять.
    prisma.task.findMany({
      where: { userId: user.id, date, status: TaskStatus.MOVED },
      orderBy: { order: "asc" },
    }),
    // Частично сделанные в течение дня (кнопкой "Частично выполнено") — уже
    // закрыты со своей заметкой, повторно спрашивать "почему не получилось"
    // здесь не нужно, продолжение живёт отдельной задачей на другом дне.
    prisma.task.findMany({
      where: { userId: user.id, date, status: TaskStatus.PARTIAL },
      orderBy: { order: "asc" },
    }),
    getCycleSettings(),
  ]);

  const cycleInfo = cycleSettings.cycleStartDate
    ? getCycleInfo(cycleSettings.cycleStartDate, date, cycleSettings.cycleLengthDays ?? undefined, cycleSettings.periodLengthDays ?? undefined)
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">Итог дня</h1>
          <p className="text-sm text-neutral-500">{formatDateHuman(date)}</p>
          {existingDay && (
            <p className="text-xs text-ink-600 mt-0.5">Итог уже был подведён — можно поправить и сохранить заново.</p>
          )}
        </div>
        <div className="flex items-center gap-1 text-sm shrink-0">
          <Link
            href={`/today/summary?date=${toDateInputValue(prevDate)}`}
            className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            ← Вчера
          </Link>
          {!isToday && (
            <Link href="/today/summary" className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600">
              Сегодня
            </Link>
          )}
          <Link
            href={`/today/summary?date=${toDateInputValue(nextDate)}`}
            className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            Завтра →
          </Link>
        </div>
      </div>

      <form action={submitEveningForm} className="space-y-6">
        <input type="hidden" name="date" value={toDateInputValue(date)} />

        {tasks.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-600">Задачи</h2>
            {tasks.map((t) => (
              <EveningTaskRow key={t.id} task={{ ...t, projectName: t.project?.name ?? null }} />
            ))}
          </div>
        )}
        {tasks.length === 0 && movedTasks.length === 0 && partialTasks.length === 0 && (
          <p className="text-sm text-neutral-400">
            В этот день план был пуст — подводить особо нечего, но метрики ниже заполнить всё равно можно.
          </p>
        )}

        {partialTasks.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-neutral-600">Частично выполнено</h2>
            <ul className="space-y-1">
              {partialTasks.map((t) => (
                <li key={t.id} className="text-sm bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  <span className="text-neutral-800">{t.text}</span>
                  <span className="text-xs text-neutral-500">
                    {" "}— {t.movedToDate ? `продолжение → ${formatDateHuman(t.movedToDate)}` : "без даты продолжения"}
                  </span>
                  {t.whySucceeded && (
                    <p className="text-xs text-neutral-500 mt-0.5">Сделано: {t.whySucceeded}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {movedTasks.length > 0 && (
          <div className="space-y-1.5">
            <h2 className="text-sm font-medium text-neutral-600">Убрано из плана в течение дня</h2>
            <ul className="space-y-1">
              {movedTasks.map((t) => (
                <li key={t.id} className="text-sm">
                  <span className="line-through text-neutral-400">{t.text}</span>
                  <span className="text-xs text-neutral-500">
                    {" "}— {t.movedToDate ? `перенесена на ${formatDateHuman(t.movedToDate)}` : "убрана из плана"}
                    {" · "}
                    <UndoMoveButton taskId={t.id} />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 bg-white border border-neutral-200 rounded-lg p-3">
          <h2 className="text-sm font-medium text-neutral-600 col-span-2">Метрики дня (1–10)</h2>
          {[
            ["difficulty", "Трудность"],
            ["mood", "Настроение"],
            ["efficiency", "Эффективность"],
            ["worry", "Переживания"],
          ].map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <select
                name={name}
                defaultValue={String(existingDay?.[name as "difficulty" | "mood" | "efficiency" | "worry"] ?? 5)}
                className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
              >
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <DayContextFields
          cycleDay={existingDay?.cycleDay ?? cycleInfo?.day ?? null}
          cyclePhaseLabel={cycleInfo ? `день ${cycleInfo.day} · ${cycleInfo.phaseLabel}` : null}
          hasPms={existingDay?.hasPms ?? null}
          hadConflict={existingDay?.hadConflict ?? null}
          conflictWith={existingDay?.conflictWith ?? null}
          conflictAbout={existingDay?.conflictAbout ?? null}
        />

        <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-3">
          <h2 className="text-sm font-medium text-neutral-600">Почему так вышло</h2>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Что получилось и почему</label>
            <textarea
              name="whyWorked"
              rows={2}
              defaultValue={existingDay?.whyWorked ?? ""}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Что не получилось и почему</label>
            <textarea
              name="whyNotWorked"
              rows={2}
              defaultValue={existingDay?.whyNotWorked ?? ""}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <label className="block text-sm font-medium mb-1">Вывод на завтра</label>
          <textarea
            name="conclusion"
            rows={2}
            defaultValue={existingDay?.conclusion ?? ""}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </div>

        <EveningSummaryCounter total={tasks.length} />

        <EveningSubmitButton firstSave={!existingDay} />
      </form>
    </div>
  );
}
