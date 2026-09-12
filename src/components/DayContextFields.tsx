"use client";

import { useState } from "react";

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
    <details className="group bg-white border border-neutral-200 rounded-lg" open>
      <summary className="cursor-pointer select-none list-none flex items-center justify-between px-3 py-2.5">
        <span>
          <span className="text-sm font-medium text-neutral-600">Контекст дня</span>
          <span className="block text-[11px] text-neutral-400 mt-0.5">Видно только вам — в этом кабинете вы единственный пользователь.</span>
        </span>
        <span className="text-neutral-400 text-xs shrink-0 transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="px-3 pb-3 space-y-3">

      {cyclePhaseLabel && (
        <p className="text-sm">
          <span className="text-neutral-500">ПМС: </span>
          <span className="font-medium">{isPms ? "да" : "нет"}</span>
          <span className="text-xs text-neutral-400"> · {cyclePhaseLabel}</span>
        </p>
      )}

      <div>
        <span className="block text-xs text-neutral-500 mb-1.5">Были конфликты?</span>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="hadConflict" value="no" checked={!conflict} onChange={() => setConflict(false)} />
            Нет
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" name="hadConflict" value="yes" checked={conflict} onChange={() => setConflict(true)} />
            Да
          </label>
        </div>
      </div>

      {conflict && (
        <div className="space-y-2 pt-2 border-t border-neutral-100">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">С кем</label>
            <input
              type="text"
              name="conflictWith"
              defaultValue={conflictWith ?? ""}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Из-за чего / суть</label>
            <textarea
              name="conflictAbout"
              rows={2}
              defaultValue={conflictAbout ?? ""}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
        </div>
      )}
      </div>
    </details>
  );
}
