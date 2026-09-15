"use client";

import { useRouter } from "next/navigation";
import { addDays, toDateInputValue, parseDateInputValue } from "@/lib/dates";
import { IconCalendar, IconChevronLeft, IconChevronRight } from "@/components/icons";

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

  // Единая «гребёнка» из белой поверхности с волоском вместо четырёх
  // самостоятельных кнопок вразнобой: это один орган управления (перемещение
  // по дням), и выглядеть он должен как один.
  const step =
    "w-8 h-8 flex items-center justify-center text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50 transition-colors";

  return (
    <div className="inline-flex items-center rounded-lg bg-white ring-1 ring-neutral-200 shadow-2xs overflow-hidden divide-x divide-neutral-200">
      <button
        type="button"
        onClick={() => go(prevDate)}
        aria-label="Предыдущий день"
        title="Предыдущий день"
        className={step}
      >
        <IconChevronLeft size={15} />
      </button>

      {!isToday && (
        <button
          type="button"
          onClick={() => go(parseDateInputValue(todayISO))}
          className="px-2.5 h-8 text-[11px] font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-50 transition-colors"
        >
          Сегодня
        </button>
      )}

      <label className={`relative ${step}`} title="Выбрать день">
        <IconCalendar size={15} />
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
        className={step}
      >
        <IconChevronRight size={15} />
      </button>
    </div>
  );
}
