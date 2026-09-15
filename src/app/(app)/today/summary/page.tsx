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
import DayMetrics from "@/components/DayMetrics";
import { requireUser } from "@/lib/auth";
import { IconChevronDown, IconChevronLeft, IconChevronRight } from "@/components/icons";

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
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">Итог дня</h1>
          <p className="text-sm text-neutral-500 mt-1 first-letter:uppercase">{formatDateHuman(date)}</p>
          {existingDay && (
            <p className="inline-flex items-center gap-1.5 text-xs text-ink-700 bg-ink-50 rounded-md px-2 py-1 mt-2">
              Итог уже был подведён — можно поправить и сохранить заново.
            </p>
          )}
        </div>
        {/* Та же «гребёнка», что и в навигации по дням в Плане дня — один
            и тот же орган управления должен выглядеть одинаково на обоих
            экранах. */}
        <div className="inline-flex items-center rounded-lg bg-white ring-1 ring-neutral-200 shadow-2xs overflow-hidden divide-x divide-neutral-200 shrink-0">
          <Link
            href={`/today/summary?date=${toDateInputValue(prevDate)}`}
            className="inline-flex items-center gap-1 px-2.5 h-8 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            <IconChevronLeft size={13} />
            Вчера
          </Link>
          {!isToday && (
            <Link
              href="/today/summary"
              className="px-2.5 h-8 inline-flex items-center text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
            >
              Сегодня
            </Link>
          )}
          <Link
            href={`/today/summary?date=${toDateInputValue(nextDate)}`}
            className="inline-flex items-center gap-1 px-2.5 h-8 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
          >
            Завтра
            <IconChevronRight size={13} />
          </Link>
        </div>
      </div>

      <form action={submitEveningForm} className="space-y-7">
        <input type="hidden" name="date" value={toDateInputValue(date)} />

        {tasks.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.08em] px-1">Задачи</h2>
            {tasks.map((t) => (
              <EveningTaskRow key={t.id} task={{ ...t, projectName: t.project?.name ?? null }} />
            ))}
          </div>
        )}
        {tasks.length === 0 && movedTasks.length === 0 && partialTasks.length === 0 && (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-8 text-center">
            <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
              В этот день план был пуст — подводить особо нечего, но метрики ниже заполнить всё равно можно.
            </p>
          </div>
        )}

        {partialTasks.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.08em] px-1">
              Частично выполнено
            </h2>
            <ul className="space-y-1.5">
              {partialTasks.map((t) => (
                <li key={t.id} className="text-sm bg-blue-50/70 ring-1 ring-blue-100 rounded-xl px-3.5 py-2.5">
                  <p className="text-neutral-900">{t.text}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t.movedToDate ? `продолжение → ${formatDateHuman(t.movedToDate)}` : "без даты продолжения"}
                  </p>
                  {t.whySucceeded && (
                    <p className="text-xs text-neutral-500 mt-1">Сделано: {t.whySucceeded}</p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {movedTasks.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.08em] px-1">
              Убрано из плана в течение дня
            </h2>
            <ul className="space-y-1.5">
              {movedTasks.map((t) => (
                <li key={t.id} className="text-sm rounded-xl bg-neutral-100/70 px-3.5 py-2.5">
                  <p className="line-through text-neutral-400">{t.text}</p>
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {t.movedToDate ? `перенесена на ${formatDateHuman(t.movedToDate)}` : "убрана из плана"}
                    {" · "}
                    <UndoMoveButton taskId={t.id} />
                  </p>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DayMetrics
          existingDay={
            existingDay
              ? {
                  difficulty: existingDay.difficulty,
                  mood: existingDay.mood,
                  efficiency: existingDay.efficiency,
                  worry: existingDay.worry,
                }
              : null
          }
        />

        <DayContextFields
          cyclePhaseLabel={cycleInfo ? `день ${cycleInfo.day} · ${cycleInfo.phaseLabel}` : null}
          isPms={cycleInfo?.phase === "pms"}
          hadConflict={existingDay?.hadConflict ?? null}
          conflictWith={existingDay?.conflictWith ?? null}
          conflictAbout={existingDay?.conflictAbout ?? null}
        />

        <details className="group surface overflow-hidden" open>
          <summary className="select-none list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">
            <span className="text-sm font-semibold text-neutral-800">Что заберу из этого дня?</span>
            <IconChevronDown
              size={16}
              className="text-neutral-400 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4">
            <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">
              Что было интересного, важного, полезного, за что благодарна или что хочется запомнить.
            </p>
            <textarea
              name="takeaway"
              rows={3}
              defaultValue={existingDay?.whyWorked ?? ""}
              className="field resize-none"
            />
          </div>
        </details>

        <details className="group surface overflow-hidden" open>
          <summary className="select-none list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">
            <span className="text-sm font-semibold text-neutral-800">Вывод на завтра</span>
            <IconChevronDown
              size={16}
              className="text-neutral-400 shrink-0 transition-transform group-open:rotate-180"
            />
          </summary>
          <div className="px-4 pb-4">
            <p className="text-[11px] text-neutral-500 mb-2 leading-relaxed">
              Не план на завтра — одна короткая рекомендация себе.
            </p>
            <textarea
              name="conclusion"
              rows={3}
              defaultValue={existingDay?.conclusion ?? ""}
              className="field resize-none"
            />
          </div>
        </details>

        <EveningSummaryCounter total={tasks.length} />

        <EveningSubmitButton firstSave={!existingDay} />
      </form>
    </div>
  );
}
