"use client";

import { useState } from "react";
import { todayDate, tomorrowDate, toDateInputValue, formatDateHuman } from "@/lib/dates";

export default function PartialCompleteDialog({
  taskText,
  onClose,
  onSubmit,
}: {
  taskText: string;
  onClose: () => void;
  onSubmit: (input: { doneNote: string | null; remainingNote: string | null; newDateISO: string | null }) => Promise<void> | void;
}) {
  const todayISO = toDateInputValue(todayDate());
  const tomorrowISO = toDateInputValue(tomorrowDate());

  const [doneNote, setDoneNote] = useState("");
  const [remainingNote, setRemainingNote] = useState("");
  const [mode, setMode] = useState<"today" | "tomorrow" | "custom" | "none">("tomorrow");
  const [customDate, setCustomDate] = useState("");
  const [saving, setSaving] = useState(false);

  const pill = (active: boolean) =>
    `px-2.5 py-1.5 rounded-lg border text-sm font-medium ${
      active ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
    }`;

  async function handleSubmit() {
    const newDateISO = mode === "today" ? todayISO : mode === "tomorrow" ? tomorrowISO : mode === "custom" ? customDate || null : null;
    setSaving(true);
    await onSubmit({ doneNote: doneNote.trim() || null, remainingNote: remainingNote.trim() || null, newDateISO });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Частично выполнено</p>
          <p className="text-sm font-medium text-neutral-800 mt-0.5">{taskText}</p>
        </div>

        <p className="text-xs text-neutral-500">
          Задача закроется с пометкой «частично», а остаток продолжится отдельной новой задачей.
        </p>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Что уже сделано? (необязательно)</label>
          <textarea
            autoFocus
            rows={2}
            value={doneNote}
            onChange={(e) => setDoneNote(e.target.value)}
            placeholder="Например: написала черновик, осталось отправить"
            className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Что осталось? (необязательно)</label>
          <textarea
            rows={2}
            value={remainingNote}
            onChange={(e) => setRemainingNote(e.target.value)}
            placeholder="Заметка перейдёт в новую задачу"
            className="w-full border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm resize-none"
          />
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">Когда продолжить</label>
          <div className="flex items-center gap-1.5 flex-wrap">
            <button type="button" className={pill(mode === "today")} onClick={() => setMode("today")}>Сегодня</button>
            <button type="button" className={pill(mode === "tomorrow")} onClick={() => setMode("tomorrow")}>Завтра</button>
            <button type="button" className={pill(mode === "custom")} onClick={() => setMode("custom")}>
              {mode === "custom" && customDate ? formatDateHuman(new Date(`${customDate}T00:00:00.000Z`)) : "Другая дата"}
            </button>
            <button type="button" className={pill(mode === "none")} onClick={() => setMode("none")}>Без даты</button>
          </div>
          {mode === "custom" && (
            <input
              type="date"
              autoFocus
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="mt-2 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 text-sm px-4 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (mode === "custom" && !customDate)}
            className="flex-1 text-sm px-4 py-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {saving ? "Сохраняю…" : "Отметить частично выполненной"}
          </button>
        </div>
      </div>
    </div>
  );
}
