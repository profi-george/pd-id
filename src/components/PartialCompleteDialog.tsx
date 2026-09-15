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

  // Выбранный вариант — чернильная пилюля с мягким кольцом, а не чёрный
  // прямоугольник: это тот же язык выбора, что и везде в приложении.
  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-lg text-[13px] font-medium ring-1 transition-colors ${
      active
        ? "bg-ink-50 text-ink-700 ring-ink-300"
        : "bg-white text-neutral-600 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
    }`;

  async function handleSubmit() {
    const newDateISO = mode === "today" ? todayISO : mode === "tomorrow" ? tomorrowISO : mode === "custom" ? customDate || null : null;
    setSaving(true);
    await onSubmit({ doneNote: doneNote.trim() || null, remainingNote: remainingNote.trim() || null, newDateISO });
    setSaving(false);
  }

  return (
    <div
      className="fixed inset-0 bg-neutral-950/35 backdrop-blur-[3px] z-50 flex items-center justify-center p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl ring-1 ring-neutral-200 w-full max-w-md p-5 sm:p-6 space-y-4 animate-rise-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.08em]">Частично выполнено</p>
          <p className="text-base font-semibold text-neutral-900 mt-1 leading-snug tracking-[-0.015em]">{taskText}</p>
        </div>

        <p className="text-xs text-neutral-500 leading-relaxed">
          Задача закроется с пометкой «частично», а остаток продолжится отдельной новой задачей.
        </p>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Что уже сделано? (необязательно)</label>
          <textarea
            autoFocus
            rows={2}
            value={doneNote}
            onChange={(e) => setDoneNote(e.target.value)}
            placeholder="Например: написала черновик, осталось отправить"
            className="field resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Что осталось? (необязательно)</label>
          <textarea
            rows={2}
            value={remainingNote}
            onChange={(e) => setRemainingNote(e.target.value)}
            placeholder="Заметка перейдёт в новую задачу"
            className="field resize-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-600 mb-1.5">Когда продолжить</label>
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
              aria-label="Дата продолжения"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="field mt-2 max-w-[12rem]"
            />
          )}
        </div>

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="btn btn-secondary btn-lg flex-1">
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving || (mode === "custom" && !customDate)}
            className="btn btn-primary btn-lg flex-1"
          >
            {saving ? "Сохраняю…" : "Отметить частично выполненной"}
          </button>
        </div>
      </div>
    </div>
  );
}
