import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { formatDateHuman, toDateInputValue, todayDate } from "@/lib/dates";
import { tasksWord } from "@/lib/pluralize";
import { requireUser } from "@/lib/auth";
import { IconArrowRight, IconChevronLeft, IconChevronRight } from "@/components/icons";

export const dynamic = "force-dynamic";

const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

function monthParamOf(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: monthParam } = await searchParams;

  const today = todayDate();
  let viewYear = today.getUTCFullYear();
  let viewMonth = today.getUTCMonth(); // 0-11
  if (monthParam && /^\d{4}-\d{2}$/.test(monthParam)) {
    const [y, m] = monthParam.split("-").map(Number);
    viewYear = y;
    viewMonth = m - 1;
  }
  const monthStart = new Date(Date.UTC(viewYear, viewMonth, 1));
  const prevMonth = new Date(Date.UTC(viewYear, viewMonth - 1, 1));
  const nextMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 1));
  const daysInMonth = new Date(Date.UTC(viewYear, viewMonth + 1, 0)).getUTCDate();
  const leadingBlanks = (monthStart.getUTCDay() + 6) % 7; // Пн = 0

  const [days, taskGroups, scoreGroups] = await Promise.all([
    prisma.day.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.task.groupBy({
      by: ["date", "status"],
      where: { userId: user.id, date: { not: null } },
      _count: true,
    }),
    prisma.task.groupBy({
      by: ["date"],
      where: { userId: user.id, date: { not: null }, score: { not: null } },
      _avg: { score: true },
    }),
  ]);

  const avgScoreByMs = new Map<number, number>();
  for (const g of scoreGroups) {
    if (!g.date || g._avg.score == null) continue;
    avgScoreByMs.set(g.date.getTime(), g._avg.score);
  }

  const daysByMs = new Map(days.map((d) => [d.date.getTime(), d]));
  const summarizedDates = new Set(days.map((d) => d.date.getTime()));

  const countsByMs = new Map<number, { total: number; done: number }>();
  for (const g of taskGroups) {
    if (!g.date) continue;
    const ms = g.date.getTime();
    const entry = countsByMs.get(ms) ?? { total: 0, done: 0 };
    entry.total += g._count;
    if (g.status === TaskStatus.DONE) entry.done += g._count;
    countsByMs.set(ms, entry);
  }

  const allDates = new Set<number>(summarizedDates);
  for (const ms of countsByMs.keys()) allDates.add(ms);

  const sortedDates = Array.from(allDates).sort((a, b) => b - a);
  const todayMs = today.getTime();

  const cells: (Date | null)[] = Array(leadingBlanks).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(Date.UTC(viewYear, viewMonth, d)));

  return (
    <div className="space-y-7 max-w-lg">
      <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">История</h1>

      {/* Календарь — приподнятая поверхность, а не сетка ссылок «на весу»:
          это отдельный инструмент навигации, и у него должны быть границы. */}
      <div className="surface p-3 sm:p-4">
        <div className="flex items-center justify-between mb-3">
          <Link
            href={`/history?month=${monthParamOf(prevMonth)}`}
            aria-label="Предыдущий месяц"
            className="icon-btn"
          >
            <IconChevronLeft size={16} />
          </Link>
          <p className="text-sm font-semibold text-neutral-900 tracking-[-0.01em]">
            {MONTH_NAMES[viewMonth]} <span className="text-neutral-400 font-normal tabular-nums">{viewYear}</span>
          </p>
          <Link
            href={`/history?month=${monthParamOf(nextMonth)}`}
            aria-label="Следующий месяц"
            className="icon-btn"
          >
            <IconChevronRight size={16} />
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-semibold uppercase tracking-[0.06em] text-neutral-400 mb-1.5">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} />;
            const ms = date.getTime();
            const hasContent = allDates.has(ms);
            const isToday = ms === todayMs;
            const iso = toDateInputValue(date);
            // Цвет точки — по эффективности дня, если итог подведён: беглым
            // взглядом по месяцу видно, где было тяжело, а не только "что-то было".
            const efficiency = daysByMs.get(ms)?.efficiency ?? null;
            const dotClass =
              efficiency == null
                ? "bg-ink-400"
                : efficiency >= 7
                ? "bg-emerald-500"
                : efficiency >= 4
                ? "bg-amber-500"
                : "bg-red-400";
            return (
              <Link
                key={ms}
                href={`/today?date=${iso}`}
                // Сегодня — кольцо акцента вокруг ячейки вместо чёрной заливки:
                // заливка перекрывала точку эффективности, и как раз про сегодня
                // сводку было видно хуже всего.
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-[13px] tabular-nums relative transition-colors ${
                  isToday
                    ? "bg-ink-50 text-ink-700 font-semibold ring-2 ring-ink-500"
                    : hasContent
                    ? "bg-neutral-50 ring-1 ring-neutral-200 hover:bg-white hover:ring-neutral-300 text-neutral-800 font-medium"
                    : "text-neutral-400 hover:bg-neutral-50"
                }`}
              >
                {date.getUTCDate()}
                <span className="h-1.5 mt-1 flex items-center" aria-hidden>
                  {hasContent && <span className={`w-1.5 h-1.5 rounded-full ${dotClass}`} />}
                </span>
              </Link>
            );
          })}
        </div>
        {/* Легенда: без неё цвет точки — просто украшение. */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-3 pt-3 border-t border-neutral-100 text-[10px] text-neutral-500">
          <span className="font-semibold uppercase tracking-[0.06em] text-neutral-400">Эффективность</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />7–10</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />4–6</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-red-400" />1–3</span>
          <span className="inline-flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-ink-400" />итог не подведён</span>
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-10 text-center">
          <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">
            Первая запись появится, как только вы подведёте итог сегодняшнего дня.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {sortedDates.map((ms) => {
            const date = new Date(ms);
            const iso = toDateInputValue(date);
            const summarized = summarizedDates.has(ms);
            const counts = countsByMs.get(ms);
            const day = daysByMs.get(ms);
            const avgScore = avgScoreByMs.get(ms);
            return (
              <li key={ms} className="surface px-4 py-3 transition-shadow hover:shadow-sm">
                <p className="text-sm font-semibold text-neutral-900 first-letter:uppercase">
                  {formatDateHuman(date)}
                  {ms === todayMs && (
                    <span className="ml-1.5 chip bg-ink-50 text-ink-700 align-middle">сегодня</span>
                  )}
                </p>
                {counts && counts.total > 0 && (
                  <p className="text-xs text-neutral-500 mt-1 tabular-nums">
                    {counts.total} {tasksWord(counts.total)} · {counts.done} выполнено
                    {avgScore != null && <> · средняя оценка {avgScore.toFixed(1)}</>}
                    {day?.efficiency != null && <> · эффективность {day.efficiency}/10</>}
                  </p>
                )}
                {day && (day.cycleDay != null || day.mood != null || day.hasPms != null || day.hadConflict != null) && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {day.cycleDay != null && <>день цикла {day.cycleDay}</>}
                    {day.cycleDay != null && day.mood != null && <> · </>}
                    {day.mood != null && <>настроение {day.mood}/10</>}
                    {(day.cycleDay != null || day.mood != null) && day.hasPms && <> · </>}
                    {day.hasPms && <>ПМС</>}
                    {(day.cycleDay != null || day.mood != null || day.hasPms) && day.hadConflict != null && <> · </>}
                    {day.hadConflict === true && <>был конфликт</>}
                    {day.hadConflict === false && <>без конфликтов</>}
                  </p>
                )}
                {day?.hadConflict && (day.conflictWith || day.conflictAbout) && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {day.conflictWith && <>с {day.conflictWith}</>}
                    {day.conflictWith && day.conflictAbout && <> — </>}
                    {day.conflictAbout}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs mt-2 pt-2 border-t border-neutral-100">
                  <Link
                    href={`/today?date=${iso}`}
                    className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 -mx-1.5 text-ink-600 font-medium hover:bg-ink-50 transition-colors"
                  >
                    План дня
                    <IconArrowRight size={12} />
                  </Link>
                  {summarized ? (
                    <Link
                      href={`/today/summary?date=${iso}`}
                      className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-ink-600 font-medium hover:bg-ink-50 transition-colors"
                    >
                      Итог дня
                      <IconArrowRight size={12} />
                    </Link>
                  ) : (
                    <span className="text-neutral-400 px-1.5">итог не подведён</span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
