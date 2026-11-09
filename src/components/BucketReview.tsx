"use client";

import type { AiTaskEvaluation } from "@/lib/ai";
import { BUCKET_ORDER, BUCKET_TEXT, TODAY_MAX_TASKS, bucketForDate, type Bucket } from "@/lib/buckets";
import { parseDateInputValue, todayDate, toDateInputValue } from "@/lib/dates";
import { IconCalendar } from "@/components/icons";

function shortDate(iso: string) {
  return parseDateInputValue(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", weekday: "short", timeZone: "UTC" });
}

// Разбор списка: одна строка на задачу и один ряд "когда" под ней —
// Сегодня / Завтра / На неделе / Потом или конкретная дата. ИИ уже выбрал
// вариант, здесь его можно поменять одним нажатием.
export default function BucketReview({
  tasks,
  onMove,
  onDate,
}: {
  tasks: AiTaskEvaluation[];
  onMove: (index: number, bucket: Bucket) => void;
  onDate: (index: number, dateISO: string | null) => void;
}) {
  const todayISO = toDateInputValue(todayDate());
  // Активная кнопка: дата сегодня/завтра — это "Сегодня"/"Завтра", любая другая
  // дата — кнопка с календарём, без даты — корзина, которую выбрал ИИ.
  function activeOf(t: AiTaskEvaluation): Bucket | "date" {
    if (t.scheduledDate) {
      const b = bucketForDate(t.scheduledDate, todayISO);
      return b === "today" || b === "tomorrow" ? b : "date";
    }
    return t.bucket ?? "week";
  }

  // Порядок не пересортировываем по "когда": задача не должна уезжать из-под
  // пальца сразу после нажатия.
  const rows = tasks.map((t, i) => ({ t, i }));
  const todayCount = tasks.filter((t) => activeOf(t) === "today").length;

  return (
    <div className="space-y-2">
      {todayCount > TODAY_MAX_TASKS && (
        <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5">
          На сегодня {todayCount} задачи — обычно успевается не больше {TODAY_MAX_TASKS}.
        </p>
      )}
      <ul className="space-y-1.5">
        {rows.map(({ t, i }) => {
          const active = activeOf(t);
          return (
            <li key={i} className="bg-white ring-1 ring-neutral-200 rounded-xl px-3 py-2.5">
              <p className="text-sm font-medium text-neutral-900 leading-snug">{t.text}</p>
              {t.deadline && (
                <p className="text-xs text-red-600/80 mt-0.5">срок до {shortDate(t.deadline)}</p>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2" role="group" aria-label="Когда">
                {BUCKET_ORDER.map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => onMove(i, b)}
                    className={`rounded-full text-xs px-2.5 py-1 border transition-colors ${
                      active === b
                        ? "bg-indigo-600 border-indigo-600 text-white"
                        : "border-neutral-200 text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
                    }`}
                  >
                    {BUCKET_TEXT[b]}
                  </button>
                ))}
                {/* Нативный выбор даты поверх кнопки — одно нажатие открывает календарь. */}
                <label
                  className={`relative inline-flex items-center gap-1 rounded-full text-xs px-2.5 py-1 border cursor-pointer transition-colors ${
                    active === "date"
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-indigo-300 hover:text-indigo-700"
                  }`}
                >
                  <IconCalendar size={12} />
                  {active === "date" && t.scheduledDate ? shortDate(t.scheduledDate) : "Дата"}
                  <input
                    type="date"
                    value={t.scheduledDate ?? ""}
                    min={todayISO}
                    onChange={(e) => onDate(i, e.target.value || null)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                    aria-label="Выбрать дату"
                  />
                </label>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
