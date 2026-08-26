"use client";

import { useEffect, useRef, useState } from "react";
import type { AiTaskEvaluation } from "@/lib/ai";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  LOW_CONFIDENCE_THRESHOLD,
  type PriorityLabel,
} from "@/lib/priorityEngine";
import { CRITERIA_INFO } from "@/lib/criteriaInfo";
import { formatDateRelative, parseDateInputValue, todayDate, tomorrowDate, toDateInputValue } from "@/lib/dates";
import { tasksWord } from "@/lib/pluralize";

const SCALE = [1, 2, 3, 4, 5];
const PRIORITY_OPTIONS: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];
const DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

export type ReviewTask = AiTaskEvaluation & {
  projectId: string | null;
  includeInPlan: boolean;
  manualPriority?: PriorityLabel | null;
};
export type ProjectOption = { id: string; label: string };

// Смена приоритета одним тапом прямо на карточке проверки — без захода в критерии.
function PriorityPicker({ label, onPick }: { label: PriorityLabel; onPick: (l: PriorityLabel) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md border border-neutral-300 bg-white text-neutral-700 font-medium hover:border-ink-300 hover:bg-neutral-50"
        title="Изменить приоритет"
      >
        <span className={`w-2 h-2 rounded-full ${DOT_CLASS[label]}`} />
        {PRIORITY_LABEL_TEXT[label]}
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-400 shrink-0">
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm">
          {PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { setOpen(false); onPick(l); }}
              className={`w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-neutral-50 ${
                l === label ? "font-medium text-neutral-900" : "text-neutral-700"
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${DOT_CLASS[l]}`} />
              {PRIORITY_LABEL_TEXT[l]}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Раньше тут была одна галочка "в план на сегодня/на дату из AI" — если дата не
// сегодня и не распознана AI, поправить её можно было только в открытой панели
// "Почему? / настроить". Теперь выбор даты виден сразу и без даты не остаётся
// молча — под рядом кнопок появляется мягкое напоминание, а не блокирующий шаг.
function PlanPicker({
  includeInPlan,
  scheduledDate,
  onChange,
}: {
  includeInPlan: boolean;
  scheduledDate: string | null;
  onChange: (patch: Partial<ReviewTask>) => void;
}) {
  const [pickingDate, setPickingDate] = useState(false);
  const todayISO = toDateInputValue(todayDate());
  const tomorrowISO = toDateInputValue(tomorrowDate());
  const isToday = includeInPlan && (!scheduledDate || scheduledDate === todayISO);
  const isTomorrow = includeInPlan && scheduledDate === tomorrowISO;
  const isCustom = includeInPlan && Boolean(scheduledDate) && scheduledDate !== todayISO && scheduledDate !== tomorrowISO;

  const pill = (active: boolean) =>
    `px-2 py-1 rounded-md border text-xs font-medium ${
      active ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 text-neutral-600 hover:bg-neutral-50"
    }`;

  return (
    <div>
      <div className="flex items-center gap-1.5 flex-wrap">
        <button type="button" className={pill(isToday)} onClick={() => { onChange({ includeInPlan: true, scheduledDate: null }); setPickingDate(false); }}>
          Сегодня
        </button>
        <button type="button" className={pill(isTomorrow)} onClick={() => { onChange({ includeInPlan: true, scheduledDate: tomorrowISO }); setPickingDate(false); }}>
          Завтра
        </button>
        <button type="button" className={pill(isCustom)} onClick={() => setPickingDate((v) => !v)}>
          {isCustom && scheduledDate ? formatDateRelative(parseDateInputValue(scheduledDate)) : "Другая дата"}
        </button>
        <button type="button" className={pill(!includeInPlan)} onClick={() => { onChange({ includeInPlan: false, scheduledDate: null }); setPickingDate(false); }}>
          Без даты
        </button>
        {pickingDate && (
          <input
            type="date"
            autoFocus
            value={scheduledDate ?? ""}
            onChange={(e) => { if (e.target.value) { onChange({ includeInPlan: true, scheduledDate: e.target.value }); setPickingDate(false); } }}
            className="border border-neutral-300 rounded-md px-1.5 py-1 text-xs"
          />
        )}
      </div>
      {!includeInPlan && (
        <p className="text-[11px] text-neutral-400 mt-1">
          Без даты задача уйдёт в «Задачи» — можно сразу{" "}
          <button type="button" onClick={() => onChange({ includeInPlan: true, scheduledDate: null })} className="underline hover:text-neutral-600">
            выбрать день
          </button>.
        </p>
      )}
    </div>
  );
}

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
    manualPriority: task.manualPriority ?? null,
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

      <PlanPicker
        includeInPlan={task.includeInPlan}
        scheduledDate={task.scheduledDate}
        onChange={onChange}
      />

      <div className="flex items-center gap-2 text-xs flex-wrap">
        <PriorityPicker
          label={label}
          onPick={(l) => onChange({ manualPriority: l })}
        />
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
          Задачи «Без даты» попадут в «Задачи» без даты — добавите в план позже, когда решите.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || tasks.length === 0}
          className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {isSaving ? "Сохраняю..." : `Добавить ${tasks.length} ${tasksWord(tasks.length)} →`}
        </button>
      </div>
    </div>
  );
}
