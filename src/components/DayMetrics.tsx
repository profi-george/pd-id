"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/icons";

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

const METRICS: { name: "difficulty" | "mood" | "efficiency" | "worry"; label: string; hint: string }[] = [
  { name: "difficulty", label: "Трудность", hint: "Насколько тяжёлым и требовательным был этот день?" },
  { name: "mood", label: "Настроение", hint: "Каким было твоё эмоциональное состояние в течение дня?" },
  { name: "efficiency", label: "Эффективность", hint: "Насколько хорошо получилось использовать день для достижения результатов?" },
  { name: "worry", label: "Переживания", hint: "Насколько сильно ты тревожилась, напрягалась или переживала из-за происходящего?" },
];

// Кликабельные пилюли вместо голых <select> — тот же язык выбора, что уже
// используется по всему приложению (приоритет, дата), а не разномастная
// нативная форма только на этом экране.
function MetricRow({
  name,
  label,
  hint,
  defaultValue,
}: {
  name: string;
  label: string;
  hint: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <label className="text-sm font-semibold text-neutral-900">{label}</label>
          <p className="text-[11px] text-neutral-500 leading-snug mt-0.5">{hint}</p>
        </div>
        <span className="text-sm font-semibold text-neutral-900 tabular-nums shrink-0">
          {value}
          <span className="text-[11px] font-normal text-neutral-400">/10</span>
        </span>
      </div>
      <input type="hidden" name={name} value={value} />
      {/* Шкала как непрерывная дорожка: выбранное значение и всё до него
          закрашены акцентом. Раньше подсвечивалась только одна цифра, и
          «7 из 10» приходилось считывать цифрой, а не видеть как уровень. */}
      <div className="flex flex-wrap gap-1">
        {SCALE.map((n) => {
          const filled = n <= value;
          return (
            <button
              key={n}
              type="button"
              onClick={() => setValue(n)}
              aria-pressed={n === value}
              aria-label={`${label}: ${n} из 10`}
              className={`w-7 h-8 rounded-md text-xs font-semibold tabular-nums ring-1 transition-colors ${
                n === value
                  ? "bg-ink-600 text-white ring-ink-600 shadow-xs"
                  : filled
                  ? "bg-ink-50 text-ink-700 ring-ink-100"
                  : "bg-white text-neutral-500 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DayMetrics({
  existingDay,
}: {
  existingDay: { difficulty: number | null; mood: number | null; efficiency: number | null; worry: number | null } | null;
}) {
  return (
    // <details> вместо простого div — сворачивается без потери значений полей
    // внутри (закрытая секция всё равно уходит в submit формы), форма короче
    // на первый взгляд, когда задач в плане много.
    <details className="group surface overflow-hidden" open>
      <summary className="select-none list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">
        <span className="text-sm font-semibold text-neutral-800">Метрики дня</span>
        <IconChevronDown size={16} className="text-neutral-400 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="grid gap-5 px-4 pb-4 pt-1">
        {METRICS.map((m) => (
          <MetricRow key={m.name} name={m.name} label={m.label} hint={m.hint} defaultValue={existingDay?.[m.name] ?? 5} />
        ))}
      </div>
    </details>
  );
}
