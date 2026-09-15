"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/icons";

// ПМС и день цикла — только чтение, считаются из настроек цикла (см. Настройки),
// а не спрашиваются заново каждый вечер. Конфликт — единственное, что реально
// нужно вводить руками здесь, и то условно: поля появляются только при "Да".
export default function DayContextFields({
  cyclePhaseLabel,
  isPms,
  hadConflict,
  conflictWith,
  conflictAbout,
}: {
  // Если дата начала цикла не задана в настройках — null, ничего не показываем.
  cyclePhaseLabel: string | null;
  isPms: boolean;
  hadConflict: boolean | null;
  conflictWith: string | null;
  conflictAbout: string | null;
}) {
  const [conflict, setConflict] = useState(hadConflict === true);

  return (
    <details className="group surface overflow-hidden" open>
      <summary className="select-none list-none flex items-center justify-between gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors">
        <span className="min-w-0">
          <span className="block text-sm font-semibold text-neutral-800">Контекст дня</span>
          <span className="block text-[11px] text-neutral-500 mt-0.5">
            Видно только вам — в этом кабинете вы единственный пользователь.
          </span>
        </span>
        <IconChevronDown size={16} className="text-neutral-400 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="px-4 pb-4 space-y-4">
        {cyclePhaseLabel && (
          <p className="flex flex-wrap items-center gap-2 text-sm">
            <span className="text-neutral-500">ПМС:</span>
            <span className={`chip ${isPms ? "bg-rose-50 text-rose-700 ring-1 ring-rose-100" : "bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200"}`}>
              {isPms ? "да" : "нет"}
            </span>
            <span className="text-xs text-neutral-500">{cyclePhaseLabel}</span>
          </p>
        )}

        <div>
          <span className="block text-xs font-medium text-neutral-600 mb-2">Были конфликты?</span>
          {/* Радиокнопки как пара пилюль с явной областью нажатия — попасть
              пальцем в 16-пиксельный кружок на телефоне было тяжело. */}
          <div className="flex gap-2">
            {([
              [false, "Нет", "no"],
              [true, "Да", "yes"],
            ] as const).map(([val, label, formValue]) => (
              <label
                key={formValue}
                className={`flex items-center gap-2 text-[13px] px-3 py-1.5 rounded-lg ring-1 transition-colors ${
                  conflict === val
                    ? "bg-ink-50 text-ink-700 ring-ink-300 font-medium"
                    : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50"
                }`}
              >
                <input
                  type="radio"
                  name="hadConflict"
                  value={formValue}
                  checked={conflict === val}
                  onChange={() => setConflict(val)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        {conflict && (
          <div className="space-y-3 pt-3 border-t border-neutral-100 animate-rise-in">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">С кем</label>
              <input type="text" name="conflictWith" defaultValue={conflictWith ?? ""} className="field" />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Из-за чего / суть</label>
              <textarea name="conflictAbout" rows={2} defaultValue={conflictAbout ?? ""} className="field resize-none" />
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
