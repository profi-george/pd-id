import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { formatDateHuman, toDateInputValue, todayDate } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

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
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">История</h1>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Link
            href={`/history?month=${monthParamOf(prevMonth)}`}
            className="text-sm px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            ←
          </Link>
          <p className="text-sm font-medium text-neutral-700">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </p>
          <Link
            href={`/history?month=${monthParamOf(nextMonth)}`}
            className="text-sm px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
          >
            →
          </Link>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-neutral-400 mb-1">
          {WEEKDAYS.map((w) => <div key={w}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((date, i) => {
            if (!date) return <div key={`b${i}`} />;
            const ms = date.getTime();
            const hasContent = allDates.has(ms);
            const isToday = ms === todayMs;
            const iso = toDateInputValue(date);
            return (
              <Link
                key={ms}
                href={`/today?date=${iso}`}
                className={`aspect-square flex flex-col items-center justify-center rounded-lg text-sm relative ${
                  isToday
                    ? "bg-neutral-800 text-white"
                    : hasContent
                    ? "bg-white border border-neutral-200 hover:bg-neutral-50 text-neutral-800"
                    : "text-neutral-400 hover:bg-neutral-50"
                }`}
              >
                {date.getUTCDate()}
                {hasContent && !isToday && (
                  <span className="w-1 h-1 rounded-full bg-ink-500 mt-0.5" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      {sortedDates.length === 0 ? (
        <p className="text-sm text-neutral-400">Пока нет ни одного дня с планом.</p>
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
              <li key={ms} className="bg-white border border-neutral-200 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium text-neutral-800">
                  {formatDateHuman(date)}
                  {ms === todayMs && <span className="text-xs text-neutral-400 font-normal"> · сегодня</span>}
                </p>
                {counts && counts.total > 0 && (
                  <p className="text-xs text-neutral-500 mt-0.5">
                    {counts.total} задач · {counts.done} выполнено
                    {avgScore != null && <> · средняя оценка {avgScore.toFixed(1)}</>}
                    {day?.efficiency != null && <> · эффективность {day.efficiency}/10</>}
                  </p>
                )}
                <div className="flex items-center gap-3 text-xs mt-1">
                  <Link href={`/today?date=${iso}`} className="text-ink-600 underline hover:text-ink-500">
                    План дня
                  </Link>
                  {summarized ? (
                    <Link href={`/today/summary?date=${iso}`} className="text-ink-600 underline hover:text-ink-500">
                      Итог дня
                    </Link>
                  ) : (
                    <span className="text-neutral-400">итог не подведён</span>
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
