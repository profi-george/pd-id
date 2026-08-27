"use client";

import { useState } from "react";

// Поля "были ли" и "с кем/из-за чего" — конфликт заполняется только если он
// реально был, поэтому переключатель живёт здесь, на клиенте, а не как
// отдельная серверная форма.
export default function DayContextFields({
  cycleDay,
  hadConflict,
  conflictWith,
  conflictAbout,
}: {
  cycleDay: number | null;
  hadConflict: boolean | null;
  conflictWith: string | null;
  conflictAbout: string | null;
}) {
  const [conflict, setConflict] = useState(hadConflict === true);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-3">
      <h2 className="text-sm font-medium text-neutral-600">Контекст дня</h2>

      <div>
        <label className="block text-xs text-neutral-500 mb-1">День цикла</label>
        <input
          type="number"
          name="cycleDay"
          min={1}
          max={45}
          defaultValue={cycleDay ?? ""}
          placeholder="необязательно"
          className="w-24 border border-neutral-300 rounded px-2 py-1 text-sm"
        />
      </div>

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
  );
}
