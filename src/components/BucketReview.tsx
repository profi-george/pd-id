"use client";

import type { AiTaskEvaluation } from "@/lib/ai";
import { BUCKET_ORDER, BUCKET_TEXT, BUCKET_HINT, TODAY_MAX_TASKS, type Bucket } from "@/lib/buckets";
import { formatEffort } from "@/lib/priorityEngine";
import { formatDateHumanFull, parseDateInputValue } from "@/lib/dates";
import { IconCalendar, IconX } from "@/components/icons";

// Разбор списка по трём корзинам: ИИ уже разложил задачи, здесь их можно
// перекинуть одним нажатием. Перегруз "Сегодня" не запрещаем — только честно
// показываем, что столько обычно не успеть.
export default function BucketReview({
  tasks,
  onMove,
  onDate,
}: {
  tasks: AiTaskEvaluation[];
  onMove: (index: number, bucket: Bucket) => void;
  onDate: (index: number, dateISO: string | null) => void;
}) {
  const indexed = tasks.map((t, i) => ({ t, i, bucket: t.bucket ?? "week" }));

  return (
    <div className="space-y-4">
      {BUCKET_ORDER.map((bucket) => {
        const items = indexed.filter((x) => x.bucket === bucket);
        const minutes = items.reduce((s, x) => s + x.t.effortMinutes, 0);
        return (
          <section key={bucket}>
            <div className="flex items-baseline justify-between gap-2 px-0.5 mb-1.5">
              <p className="text-[13px] font-semibold text-neutral-900">
                {BUCKET_TEXT[bucket]}
                <span className="ml-1.5 font-normal text-neutral-400 tabular-nums">{items.length}</span>
              </p>
              {items.length > 0 && (
                <span className="text-[11px] text-neutral-400 tabular-nums">≈ {formatEffort(minutes)}</span>
              )}
            </div>
            {bucket === "today" && items.length > TODAY_MAX_TASKS && (
              <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 mb-1.5">
                {items.length} задачи на сегодня — обычно успевается не больше {TODAY_MAX_TASKS}.
              </p>
            )}
            {items.length === 0 ? (
              <p className="text-xs text-neutral-400 px-0.5">{BUCKET_HINT[bucket]}</p>
            ) : (
              <ul className="space-y-1.5">
                {items.map(({ t, i }) => (
                  <li key={i} className="bg-white ring-1 ring-neutral-200 rounded-xl px-3 py-2.5">
                    <p className="text-sm font-medium text-neutral-900 leading-snug">{t.text}</p>
                    {(t.bucketReason || t.primaryReason) && (
                      <p className="text-xs text-neutral-500 leading-snug mt-0.5">{t.bucketReason || t.primaryReason}</p>
                    )}
                    {t.bumpedFromToday && (
                      <p className="text-xs text-amber-700 mt-0.5">Не влезло в сегодня — день уже заполнен.</p>
                    )}
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs">
                      {/* Нативный выбор даты поверх плашки: и показывает распознанную
                          дату, и даёт поставить/сменить её одним нажатием. */}
                      <label
                        className={`relative inline-flex items-center gap-1 rounded-full px-2 py-0.5 cursor-pointer ${
                          t.scheduledDate ? "bg-indigo-50 text-indigo-700" : "text-neutral-500 hover:text-indigo-700"
                        }`}
                      >
                        <IconCalendar size={12} />
                        {t.scheduledDate ? formatDateHumanFull(parseDateInputValue(t.scheduledDate)) : "Поставить дату"}
                        <input
                          type="date"
                          value={t.scheduledDate ?? ""}
                          onChange={(e) => onDate(i, e.target.value || null)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                          aria-label="Дата задачи"
                        />
                      </label>
                      {t.scheduledDate && (
                        <button
                          type="button"
                          onClick={() => onDate(i, null)}
                          className="text-neutral-400 hover:text-red-600"
                          aria-label="Убрать дату"
                        >
                          <IconX size={12} />
                        </button>
                      )}
                      {t.deadline && (
                        <span className="text-red-600/80">срок до {formatDateHumanFull(parseDateInputValue(t.deadline))}</span>
                      )}
                    </div>
                    <div className="segmented mt-2" role="group" aria-label="Корзина">
                      {BUCKET_ORDER.map((b) => (
                        <button
                          key={b}
                          type="button"
                          className="segment"
                          data-active={b === bucket}
                          onClick={() => onMove(i, b)}
                        >
                          {BUCKET_TEXT[b]}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
