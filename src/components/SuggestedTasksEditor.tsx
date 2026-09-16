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
import { CRITERIA_INFO, type CriterionKey } from "@/lib/criteriaInfo";
import { formatDateRelative, parseDateInputValue, todayDate, tomorrowDate, toDateInputValue } from "@/lib/dates";
import { tasksWord } from "@/lib/pluralize";
import { IconChevronDown } from "@/components/icons";
import CriterionInfo from "@/components/CriterionInfo";

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
        className="flex items-center gap-1.5 px-2 py-1 rounded-md ring-1 ring-neutral-200 bg-white text-neutral-700 font-medium hover:ring-ink-300 hover:bg-neutral-50 transition-colors"
        title="Изменить приоритет"
      >
        <span className={`w-2 h-2 rounded-full ${DOT_CLASS[label]}`} />
        {PRIORITY_LABEL_TEXT[label]}
        <IconChevronDown size={11} className="text-neutral-400 shrink-0" />
      </button>
      {open && (
        <div className="menu-panel absolute left-0 top-7 z-20 w-44">
          {PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { setOpen(false); onPick(l); }}
              className="menu-item"
              data-active={l === label}
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
      active
        ? "bg-ink-50 text-ink-700 ring-1 ring-ink-300 font-medium"
        : "bg-white text-neutral-600 ring-1 ring-neutral-200 hover:bg-neutral-50 hover:text-neutral-900"
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
            className="field field-sm w-auto"
          />
        )}
      </div>
      {!includeInPlan && (
        <p className="text-[11px] text-neutral-500 mt-1.5 leading-relaxed">
          Без даты задача уйдёт в «Все задачи» — можно сразу{" "}
          <button
            type="button"
            onClick={() => { onChange({ includeInPlan: true, scheduledDate: null }); setPickingDate(true); }}
            className="underline underline-offset-2 hover:text-neutral-900 transition-colors"
          >
            выбрать день
          </button>.
        </p>
      )}
    </div>
  );
}

// Подпись критерия + значок "?" с определением и шкалой из той же CRITERIA_INFO,
// что и в TaskDrawer — иначе с одними голыми цифрами 1-5 непонятно, что именно
// они означают и чем "Скорость потери ценности" отличается от "Цены промедления".
function CriterionField({
  criterionKey,
  value,
  onChange,
}: {
  criterionKey: CriterionKey;
  value: number;
  onChange: (v: number) => void;
}) {
  const info = CRITERIA_INFO[criterionKey];
  return (
    <label className="flex items-center justify-between gap-1">
      <span className="flex items-center gap-0.5">
        {info.title}
        <CriterionInfo title={info.title} definition={info.definition} scale={info.scale} />
      </span>
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="field field-sm w-auto"
      >
        {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
      </select>
    </label>
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
    <li className="surface p-3.5 space-y-2.5">
      <div className="flex items-start gap-2">
        <textarea
          rows={2}
          value={task.text}
          onChange={(e) => onChange({ text: e.target.value })}
          className="field flex-1"
        />
        <button type="button" onClick={onRemove} className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md px-1.5 py-1 shrink-0 transition-colors">
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
          className="field field-sm w-auto max-w-[140px]"
        >
          <option value="">Без проекта</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto text-neutral-500 underline underline-offset-2 hover:text-neutral-900 transition-colors"
        >
          {expanded ? "Скрыть" : "Почему? / настроить"}
        </button>
      </div>

      {task.primaryReason && !expanded && (
        <p className="text-xs text-neutral-500">Почему: {task.primaryReason}</p>
      )}

      {task.confidence < LOW_CONFIDENCE_THRESHOLD && (
        <p className="text-xs text-amber-800 bg-amber-50 ring-1 ring-amber-200 rounded-lg px-3 py-2 leading-relaxed">
          AI не хватило данных: {task.confidenceReason || "не пояснил, чего именно."} Можно поправить
          значения ниже («Почему? / настроить»).
        </p>
      )}

      {expanded && (
        <div className="space-y-2 pt-1 border-t border-neutral-100">
          {task.primaryReason && <p className="text-xs text-neutral-600">Почему: {task.primaryReason}</p>}
          {task.riskText && <p className="text-xs text-neutral-500">Риск отложить: {task.riskText}</p>}

          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs pt-1">
            <CriterionField
              criterionKey="value"
              value={task.value}
              onChange={(v) => onChange({ value: v })}
            />
            <CriterionField
              criterionKey="costOfDelay"
              value={task.costOfDelay}
              onChange={(v) => onChange({ costOfDelay: v })}
            />
            <CriterionField
              criterionKey="timeSensitivity"
              value={task.timeSensitivity}
              onChange={(v) => onChange({ timeSensitivity: v })}
            />
            <CriterionField
              criterionKey="goalAlignment"
              value={task.goalAlignment}
              onChange={(v) => onChange({ goalAlignment: v })}
            />
            <label className="flex items-center justify-between gap-1">
              Затраты (мин)
              <input
                type="number"
                min={5}
                step={5}
                value={task.effortMinutes}
                onChange={(e) => onChange({ effortMinutes: Number(e.target.value) })}
                className="field field-sm w-16"
              />
            </label>
            <label className="flex items-center justify-between gap-1">
              Дедлайн
              <input
                type="date"
                value={task.deadline ?? ""}
                onChange={(e) => onChange({ deadline: e.target.value || null })}
                className="field field-sm w-auto"
              />
            </label>
            <label className="flex items-center justify-between gap-1">
              Запланировать на
              <input
                type="date"
                value={task.scheduledDate ?? ""}
                onChange={(e) => onChange({ scheduledDate: e.target.value || null })}
                className="field field-sm w-auto"
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
      <h2 className="text-sm font-semibold text-neutral-800 tracking-[-0.01em]">
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

      <div className="surface p-4 space-y-3 sticky bottom-4 shadow-md">
        <p className="text-xs text-neutral-500 leading-relaxed">
          Задачи «Без даты» попадут в «Все задачи» без даты — добавите в план позже, когда решите.
        </p>
        <button
          type="button"
          onClick={onSave}
          disabled={isSaving || tasks.length === 0}
          className="btn btn-primary btn-lg w-full"
        >
          {isSaving ? "Сохраняю..." : `Добавить ${tasks.length} ${tasksWord(tasks.length)} →`}
        </button>
      </div>
    </div>
  );
}
