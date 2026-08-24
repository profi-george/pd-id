import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatDateHuman, toDateInputValue, todayDate } from "@/lib/dates";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const user = await requireUser();

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
  const today = todayDate().getTime();

  return (
    <div className="space-y-4 max-w-lg">
      <h1 className="text-xl font-semibold">История</h1>
      {sortedDates.length === 0 && (
        <p className="text-sm text-neutral-400">Пока нет ни одного дня с планом.</p>
      )}
      <ul className="space-y-2">
        {sortedDates.map((ms) => {
          const date = new Date(ms);
          const iso = toDateInputValue(date);
          const summarized = summarizedDates.has(ms);
          return (
            <li key={ms} className="bg-white border border-neutral-200 rounded-lg px-3 py-2.5">
              <p className="text-sm font-medium text-neutral-800">
                {formatDateHuman(date)}
                {ms === today && <span className="text-xs text-neutral-400 font-normal"> · сегодня</span>}
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
    </div>
  );
}
