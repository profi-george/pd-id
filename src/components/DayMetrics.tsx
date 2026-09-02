"use client";

import { useState } from "react";

const SCALE = Array.from({ length: 10 }, (_, i) => i + 1);

const METRICS: { name: "difficulty" | "mood" | "efficiency" | "worry"; label: string }[] = [
  { name: "difficulty", label: "Трудность" },
  { name: "mood", label: "Настроение" },
  { name: "efficiency", label: "Эффективность" },
  { name: "worry", label: "Переживания" },
];

// Кликабельные пилюли вместо голых <select> — тот же язык выбора, что уже
// используется по всему приложению (приоритет, дата), а не разномастная
// нативная форма только на этом экране.
function MetricRow({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number;
}) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-xs text-neutral-400 tabular-nums">{value}/10</span>
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
    <div className="grid gap-4 bg-white border border-neutral-200 rounded-lg p-3">
      <h2 className="text-sm font-medium text-neutral-600">Метрики дня</h2>
      {METRICS.map((m) => (
        <MetricRow key={m.name} name={m.name} label={m.label} defaultValue={existingDay?.[m.name] ?? 5} />
      ))}
    </div>
  );
}
