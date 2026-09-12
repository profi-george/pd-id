"use client";

import { useState } from "react";

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
      <div className="flex items-center justify-between mb-1.5">
        <div>
          <label className="text-sm font-medium">{label}</label>
          <p className="text-[11px] text-neutral-400 leading-snug">{hint}</p>
        </div>
        <span className="text-xs text-neutral-400 tabular-nums shrink-0 pl-2">{value}/10</span>
      </div>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap gap-1">
        {SCALE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setValue(n)}
            className={`w-7 h-7 rounded-md text-xs font-medium tabular-nums ${
              n === value ? "bg-neutral-800 text-white" : "border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
            }`}
          >
            {n}
          </button>
        ))}
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
    <details className="group bg-white border border-neutral-200 rounded-lg" open>
      <summary className="cursor-pointer select-none list-none flex items-center justify-between px-3 py-2.5">
        <span className="text-sm font-medium text-neutral-600">Метрики дня</span>
        <span className="text-neutral-400 text-xs transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="grid gap-4 px-3 pb-3">
        {METRICS.map((m) => (
          <MetricRow key={m.name} name={m.name} label={m.label} hint={m.hint} defaultValue={existingDay?.[m.name] ?? 5} />
        ))}
      </div>
    </details>
  );
}
