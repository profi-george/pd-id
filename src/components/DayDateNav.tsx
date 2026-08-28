"use client";

import { useRouter } from "next/navigation";
import { addDays, toDateInputValue, parseDateInputValue } from "@/lib/dates";

// Стрелки вместо слов "Вчера"/"Завтра" — короче и сразу понятно, что можно
// листать дальше в любую сторону. Плюс календарь — чтобы прыгнуть сразу на
// нужный день, а не листать по одному. todayISO приходит с сервера (там же,
// где считается APP_TIMEZONE) — так "Сегодня" не зависит от часового пояса браузера.
export default function DayDateNav({
  date,
  isToday,
  todayISO,
}: {
  date: Date;
  isToday: boolean;
  todayISO: string;
}) {
  const router = useRouter();
  const prevDate = addDays(date, -1);
  const nextDate = addDays(date, 1);

  function go(d: Date) {
    router.push(`/today?date=${toDateInputValue(d)}`);
  }

  return (
    <div className="flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => go(prevDate)}
        aria-label="Предыдущий день"
        title="Предыдущий день"
        className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
      >
        ←
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => go(parseDateInputValue(todayISO))}
          className="px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600 text-xs"
        >
          Сегодня
        </button>
      )}

      <label className="relative w-8 h-8 flex items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600 cursor-pointer">
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="1.5" y="3" width="13" height="11" rx="1.5" />
          <path d="M1.5 6.5h13M4.5 1.5v3M11.5 1.5v3" />
        </svg>
        <input
          type="date"
          value={toDateInputValue(date)}
          onChange={(e) => {
            if (!e.target.value) return;
            go(parseDateInputValue(e.target.value));
          }}
          aria-label="Выбрать день"
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
      </label>

      <button
        type="button"
        onClick={() => go(nextDate)}
        aria-label="Следующий день"
        title="Следующий день"
        className="w-8 h-8 flex items-center justify-center rounded border border-neutral-300 hover:bg-neutral-50 text-neutral-600"
      >
        →
      </button>
    </div>
  );
}
