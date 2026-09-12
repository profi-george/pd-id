"use client";

import { useState } from "react";
import PriorityTag from "@/components/PriorityTag";
import type { TaskEvaluation } from "@/lib/priorityEngine";

const SCALE_10 = Array.from({ length: 11 }, (_, i) => i);

export type EveningTask = TaskEvaluation & {
  id: string;
  text: string;
  projectName: string | null;
  status?: string;
  score?: number | null;
  scoreReasoning?: string | null;
  whySucceeded?: string | null;
  whyFailed?: string | null;
};

type Outcome = "done" | "partial" | "not_done";

function outcomeFromStatus(status?: string): Outcome {
  if (status === "DONE") return "done";
  if (status === "PARTIAL") return "partial";
  return "not_done";
}

export default function EveningTaskRow({ task }: { task: EveningTask }) {
  const [outcome, setOutcome] = useState<Outcome>(outcomeFromStatus(task.status));
  // Сворачивание разобранной задачи — при 5+ задачах форма иначе ощущается
  // одной длинной анкетой; по мере разбора список визуально укорачивается.
  // Поля скрываются через CSS (hidden), а не размонтируются — значения
  // остаются в DOM и всё равно уходят в submit формы.
  const [collapsed, setCollapsed] = useState(false);
  // Оценку 0-10 считает AI при сохранении — select для ручной правки не
  // рендерится, пока не нажали "✎", поэтому его не будет и в FormData: сервер
  // узнаёт "правку не трогали" просто по отсутствию scoreOverride_<id>.
  const [editingScore, setEditingScore] = useState(false);

  const reasonLabel =
    outcome === "done" ? "Почему получилось?" : outcome === "partial" ? "Что успели сделать?" : "Почему не получилось?";
  const reasonDefault = outcome === "not_done" ? task.whyFailed ?? "" : task.whySucceeded ?? "";

  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm flex-1 min-w-0 truncate">
          {outcome === "done" && <span className="text-emerald-600 mr-1">✓</span>}
          {outcome === "partial" && <span className="text-blue-600 mr-1">◐</span>}
          {task.text}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="text-xs text-neutral-400 hover:text-neutral-700 shrink-0"
        >
          {collapsed ? "Показать" : "Свернуть"}
        </button>
      </div>

      <div className={collapsed ? "hidden" : "space-y-2"}>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          {task.projectName ? <span>{task.projectName}</span> : null}
          <PriorityTag task={task} />
        </div>

        <div className="flex flex-wrap gap-3">
          {(
            [
              ["done", "Выполнена"],
              ["partial", "Частично"],
              ["not_done", "Не выполнена"],
            ] as [Outcome, string][]
          ).map(([value, label]) => (
            <label key={value} className="flex items-center gap-1.5 text-sm">
              <input
                type="radio"
                name={`outcome_${task.id}`}
                value={value}
                checked={outcome === value}
                onChange={() => setOutcome(value)}
              />
              {label}
            </label>
          ))}
        </div>

        <label className="block text-xs">
          <span className="text-neutral-500">{reasonLabel}</span>
          <textarea
            key={outcome}
            name={`reason_${task.id}`}
            rows={2}
            defaultValue={reasonDefault}
            className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </label>

        {outcome === "not_done" && (
          <label className="flex items-center gap-1.5 text-xs text-neutral-600">
            <input
              type="checkbox"
              name={`reschedule_${task.id}`}
              // Не отмечена по умолчанию — перенос на другой день должен быть
              // осознанным решением каждый раз, а не тем, что можно случайно
              // не заметить и получить бесконечно катящуюся вперёд задачу.
              defaultChecked={false}
            />
            Перенести дальше (будни — выходные пропускаем)
          </label>
        )}
        {outcome === "partial" && (
          <p className="text-xs text-neutral-400">Оставшееся автоматически продолжится на ближайший будний день.</p>
        )}

        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>Оценка выполнения: посчитает AI</span>
          {!editingScore ? (
            <button
              type="button"
              onClick={() => setEditingScore(true)}
              className="text-neutral-400 hover:text-neutral-700"
              title="Поправить вручную"
            >
              ✎
            </button>
          ) : (
            <label className="flex items-center gap-1">
              <select
                name={`scoreOverride_${task.id}`}
                defaultValue={task.score ?? 5}
                className="border border-neutral-300 rounded px-1 py-0.5 text-sm"
              >
                {SCALE_10.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              /10
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
