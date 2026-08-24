import Link from "next/link";
import { prisma } from "@/lib/prisma";
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

  const [days, taskDates] = await Promise.all([
    prisma.day.findMany({ where: { userId: user.id }, orderBy: { date: "desc" } }),
    prisma.task.findMany({
      where: { userId: user.id, date: { not: null } },
      distinct: ["date"],
      select: { date: true },
      orderBy: { date: "desc" },
    }),
  ]);

  const summarizedDates = new Set(days.map((d) => d.date.getTime()));
  const allDates = new Set<number>(summarizedDates);
  for (const t of taskDates) {
    if (t.date) allDates.add(t.date.getTime());
  }

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
            return (
              <li key={ms} className="bg-white border border-neutral-200 rounded-lg px-3 py-2.5">
                <p className="text-sm font-medium text-neutral-800">
                  {formatDateHuman(date)}
                  {ms === todayMs && <span className="text-xs text-neutral-400 font-normal"> · сегодня</span>}
                </p>
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
