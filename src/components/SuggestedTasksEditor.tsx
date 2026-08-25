"use client";

import { useState } from "react";
import type { AiTaskEvaluation } from "@/lib/ai";
import { computePriority, formatEffort, PRIORITY_LABEL_TEXT, LOW_CONFIDENCE_THRESHOLD } from "@/lib/priorityEngine";
import { CRITERIA_INFO } from "@/lib/criteriaInfo";
import { formatDateRelative, parseDateInputValue } from "@/lib/dates";

const SCALE = [1, 2, 3, 4, 5];

export type ReviewTask = AiTaskEvaluation & { projectId: string | null; includeInPlan: boolean };
export type ProjectOption = { id: string; label: string };

function TaskCard({
  task,
  projects,
  onChange,
  onRemove,
}: {
  task: ReviewTask;
  projects: ProjectOption[];
  onChange: (patch: Partial<ReviewTask>) => void;
  onRemove: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const { label } = computePriority({
    ...task,
    urgency: task.timeSensitivity,
    deadline: task.deadline ? new Date(task.deadline) : null,
  });

  return (
    <li className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          value={task.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm"
        />
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:underline shrink-0">
          Убрать
        </button>
      </div>

      <label className="flex items-center gap-1.5 text-xs text-neutral-700 bg-neutral-50 border border-neutral-200 rounded px-2 py-1 w-fit">
        <input
          type="checkbox"
          checked={task.includeInPlan}
          onChange={(e) => onChange({ includeInPlan: e.target.checked })}
        />
        {task.scheduledDate
          ? `В план на ${formatDateRelative(parseDateInputValue(task.scheduledDate))}`
          : "В план на сегодня"}
      </label>

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <span className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 font-medium">
          {PRIORITY_LABEL_TEXT[label]}
        </span>
        <span className="text-neutral-500">{formatEffort(task.effortMinutes)}</span>
        <select
          value={task.projectId ?? ""}
          onChange={(e) => onChange({ projectId: e.target.value || null })}
          className="border border-neutral-300 rounded px-1 py-0.5 max-w-[140px]"
        >
          <option value="">Без проекта</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-neutral-500 underline hover:text-neutral-800"
        >
          {expanded ? "Скрыть" : "Почему? / настроить"}
        </button>
      </div>

      {task.primaryReason && !expanded && (
        <p className="text-xs text-neutral-500">Почему: {task.primaryReason}</p>
      )}

      {task.confidence < LOW_CONFIDENCE_THRESHOLD && (
        <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          AI не хватило данных: {task.confidenceReason || "не пояснил, чего именно."} Можно поправить
          значения ниже («Почему? / настроить»).
        </p>
      )}

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-neutral-100">
          {task.primaryReason && <p className="text-xs text-neutral-600">Почему: {task.primaryReason}</p>}
          {task.riskText && <p className="text-xs text-neutral-500">Риск отложить: {task.riskText}</p>}

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-1">
            <label className="flex items-center justify-between gap-1">
              {CRITERIA_INFO.value.title}
              <select
                value={task.value}
                onChange={(e) => onChange({ value: Number(e.target.value) })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              >
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-1">
              {CRITERIA_INFO.costOfDelay.title}
              <select
                value={task.costOfDelay}
                onChange={(e) => onChange({ costOfDelay: Number(e.target.value) })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              >
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-1">
              {CRITERIA_INFO.timeSensitivity.title}
              <select
                value={task.timeSensitivity}
                onChange={(e) => onChange({ timeSensitivity: Number(e.target.value) })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              >
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-1">
              Связь с целью
              <select
                value={task.goalAlignment}
                onChange={(e) => onChange({ goalAlignment: Number(e.target.value) })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              >
                {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            <label className="flex items-center justify-between gap-1">
              Затраты (мин)
              <input
                type="number"
                min={5}
                step={5}
                value={task.effortMinutes}
                onChange={(e) => onChange({ effortMinutes: Number(e.target.value) })}
                className="w-16 border border-neutral-300 rounded px-1 py-0.5"
              />
            </label>
            <label className="flex items-center justify-between gap-1">
              Дедлайн
              <input
                type="date"
                value={task.deadline ?? ""}
                onChange={(e) => onChange({ deadline: e.target.value || null })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              />
            </label>
            <label className="flex items-center justify-between gap-1">
              Запланировать на
              <input
                type="date"
                value={task.scheduledDate ?? ""}
                onChange={(e) => onChange({ scheduledDate: e.target.value || null })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              />
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={task.financialConsequence}
                onChange={(e) => onChange({ financialConsequence: e.target.checked })}
              />
              Финансовые последствия
            </label>
          </div>
        </div>
      )}
    </li>
  );
}

export default function SuggestedTasksEditor({
  tasks,
  onChange,
  projects,
  onSave,
  isSaving,
}: {
  tasks: ReviewTask[];
  onChange: (tasks: ReviewTask[]) => void;
  projects: ProjectOption[];
  onSave: () => void;
  isSaving: boolean;
}) {
  function updateTask(idx: number, patch: Partial<ReviewTask>) {
    const next = [...tasks];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  }

  function removeTask(idx: number) {
    onChange(tasks.filter((_, i) => i !== idx));
  }

  if (tasks.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-medium text-neutral-600">
        Проверьте и поправьте перед сохранением ({tasks.length})
      </h2>

      <ul className="space-y-2">
        {tasks.map((t, idx) => (
          <TaskCard
            key={idx}
            task={t}
            projects={projects}
            onChange={(patch) => updateTask(idx, patch)}
            onRemove={() => removeTask(idx)}
          />
        ))}
      </ul>

      <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-3">
        <p className="text-xs text-neutral-500">
          Не отмеченные задачи попадут в «Все задачи» без даты — добавите в план позже, когда решите.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || tasks.length === 0}
          className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isSaving ? "Сохраняю..." : `Сохранить все задачи (${tasks.length})`}
        </button>
      </div>
    </div>
  );
}
