"use client";

import { useEffect, useRef, useState } from "react";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_HINT,
  PRIORITY_LABEL_TEXT,
  LOW_CONFIDENCE_THRESHOLD,
  isPriorityLabel,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import { todayDate, tomorrowDate, sameDate, formatDateHuman, formatDateRelative } from "@/lib/dates";
import { CRITERIA_INFO, type CriterionKey } from "@/lib/criteriaInfo";
import CriterionInfo from "@/components/CriterionInfo";
import { recalculatePriority, answerConfidenceQuestion } from "@/app/(app)/actions";

export type SubtaskItem = { id: string; text: string; done: boolean; date?: Date | null };

export type DrawerTask = TaskEvaluation & {
  id: string;
  text: string;
  projectId: string | null;
  date?: Date | null;
  googleEventId?: string | null;
  googleEventUrl?: string | null;
  subtasks?: SubtaskItem[];
  aiValue?: number | null;
  aiCostOfDelay?: number | null;
  aiUrgency?: number | null;
  aiTimeSensitivity?: number | null;
  aiEffortMinutes?: number | null;
  aiReasoningValue?: string | null;
  aiReasoningCostOfDelay?: string | null;
  aiReasoningUrgency?: string | null;
  aiReasoningTimeSensitivity?: string | null;
  aiReasoningEffort?: string | null;
  confidenceReason?: string | null;
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Основные 4 уровня — всегда на виду одним рядом, как в остальном интерфейсе.
// LATER ("Не сейчас") — редкий случай, вынесен отдельной некрупной ссылкой ниже,
// чтобы не разбавлять четвёрку сопоставимых по весу приоритетов пятым вариантом.
const MAIN_LABELS: PriorityLabel[] = ["P0", "P1", "P2", "P3"];

const SHORT_LABEL: Record<PriorityLabel, string> = {
  P0: "Фокус",
  P1: "Высокий",
  P2: "Средний",
  P3: "Низкий",
  LATER: "Не сейчас",
};

// Те же цвета, что и в общем списке задач (PriorityMatrix) — приоритет должен
// читаться одинаково везде, а не менять палитру от экрана к экрану.
const DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

const CRITERION_FIELDS: { key: CriterionKey; aiKey: keyof DrawerTask; reasonKey: keyof DrawerTask }[] = [
  { key: "value", aiKey: "aiValue", reasonKey: "aiReasoningValue" },
  { key: "costOfDelay", aiKey: "aiCostOfDelay", reasonKey: "aiReasoningCostOfDelay" },
  { key: "timeSensitivity", aiKey: "aiTimeSensitivity", reasonKey: "aiReasoningTimeSensitivity" },
];

function IconFolder({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M1.5 3.5A1 1 0 0 1 2.5 2.5h3l1.2 1.5H13.5a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-8Z" />
    </svg>
  );
}

function IconClock({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M8 4.75V8l2.25 1.5" />
    </svg>
  );
}

function IconCalendar({ className }: { className?: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" />
    </svg>
  );
}

function IconTrash({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M3 4.5h10M6.5 4.5v-1a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1M6 7.5v4M10 7.5v4M4 4.5l.6 8a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8" />
    </svg>
  );
}

function IconSparkle({ className }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" className={className}>
      <path d="M8 1.5c.3 2.3 1 3.7 2 4.7s2.4 1.7 4.7 2c-2.3.3-3.7 1-4.7 2s-1.7 2.4-2 4.7c-.3-2.3-1-3.7-2-4.7s-2.4-1.7-4.7-2c2.3-.3 3.7-1 4.7-2s1.7-2.4 2-4.7Z" />
    </svg>
  );
}

// Клик по тексту — редактирование на месте, не отдельная форма. Раньше
// поправить формулировку можно было только удалив и создав заново, теряя
// сам факт, что этот пункт уже был.
// Своя дата у шага — не открывает попап, просто переключает "текст" на нативный
// date-инпут на месте: реже нужное действие не заслуживает отдельного диалога.
function SubtaskDateControl({
  date,
  onChange,
}: {
  date: Date | null | undefined;
  onChange: (dateISO: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        type="date"
        autoFocus
        defaultValue={date ? toDateInput(date) : ""}
        onChange={(e) => { onChange(e.target.value || null); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className="text-xs border border-neutral-300 rounded px-1 py-0.5 shrink-0"
      />
    );
  }

  return (
    <span className="shrink-0 inline-flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => setEditing(true)}
        className={`text-xs whitespace-nowrap ${
          date
            ? "text-ink-600"
            // Базово чуть видна (не opacity-0) — иначе на тач-экране до кнопки
            // не добраться вообще, наведения мышью там не бывает.
            : "text-neutral-300 opacity-40 group-hover:opacity-100 focus-visible:opacity-100"
        }`}
        aria-label={date ? `Дата шага: ${formatDateRelative(date)}. Изменить` : "Назначить дату шагу"}
      >
        {date ? formatDateRelative(date) : "+ дата"}
      </button>
      {date && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-neutral-300 hover:text-neutral-600"
          aria-label="Убрать дату шага"
          title="Убрать дату"
        >
          ×
        </button>
      )}
    </span>
  );
}

function SubtaskRow({
  subtask,
  onToggle,
  onDelete,
  onRename,
  onScheduleDate,
}: {
  subtask: SubtaskItem;
  onToggle?: (id: string, done: boolean) => void;
  onDelete?: (id: string) => void;
  onRename?: (id: string, text: string) => void;
  onScheduleDate?: (id: string, dateISO: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(subtask.text);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== subtask.text) onRename?.(subtask.id, trimmed);
    else setDraft(subtask.text);
  }

  return (
    <li className="flex items-center gap-2 group">
      <input
        type="checkbox"
        checked={subtask.done}
        onChange={(e) => onToggle?.(subtask.id, e.target.checked)}
        className="accent-ink-500 shrink-0"
      />
      {editing ? (
        <input
          type="text"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setDraft(subtask.text); setEditing(false); }
          }}
          className="flex-1 text-sm border border-neutral-300 rounded px-1.5 py-0.5"
        />
      ) : (
        <button
          type="button"
          onClick={() => { setDraft(subtask.text); setEditing(true); }}
          className={`flex-1 min-w-0 truncate text-left text-sm ${subtask.done ? "line-through text-neutral-400" : "text-neutral-700"}`}
        >
          {subtask.text}
        </button>
      )}
      {onScheduleDate && (
        <SubtaskDateControl
          date={subtask.date}
          onChange={(dateISO) => onScheduleDate(subtask.id, dateISO)}
        />
      )}
      <button
        type="button"
        onClick={() => onDelete?.(subtask.id)}
        className="text-neutral-300 hover:text-red-600 opacity-40 group-hover:opacity-100 focus-visible:opacity-100 shrink-0 text-xs px-1"
        aria-label="Удалить подзадачу"
      >
        ×
      </button>
    </li>
  );
}

function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

export default function TaskDrawer({
  task,
  projectOptions,
  googleConnected,
  onClose,
  onChangeText,
  onChangeProject,
  onChangeField,
  onManualPriority,
  onDelete,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
  onAddToCalendar,
  onRemoveFromCalendar,
  onAddSubtask,
  onToggleSubtask,
  onDeleteSubtask,
  onRenameSubtask,
  onScheduleSubtask,
}: {
  task: DrawerTask | null;
  projectOptions: { id: string; label: string }[];
  googleConnected?: boolean;
  onClose: () => void;
  onChangeText: (text: string) => void;
  onChangeProject: (projectId: string | null) => void;
  onChangeField: (patch: Partial<TaskEvaluation>) => void;
  onManualPriority: (label: PriorityLabel | null) => void;
  onDelete: () => void;
  onScheduleToday?: () => void;
  onScheduleTomorrow?: () => void;
  onScheduleDate?: (dateISO: string) => void;
  onAddToCalendar?: (date: string, startTime: string, durationMinutes: number) => Promise<{ ok: boolean; error?: string }>;
  onRemoveFromCalendar?: () => void;
  onAddSubtask?: (text: string) => void | Promise<void>;
  onToggleSubtask?: (id: string, done: boolean) => void;
  onDeleteSubtask?: (id: string) => void;
  onRenameSubtask?: (id: string, text: string) => void;
  onScheduleSubtask?: (id: string, dateISO: string | null) => void;
}) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [calTime, setCalTime] = useState("09:00");
  const [calSaving, setCalSaving] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [prevTaskId, setPrevTaskId] = useState<string | null>(task?.id ?? null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [draft, setDraft] = useState<{ value: number; costOfDelay: number; timeSensitivity: number } | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);
  const [answeringConfidence, setAnsweringConfidence] = useState(false);
  const [confidenceAnswer, setConfidenceAnswer] = useState("");
  const [confidenceLoading, setConfidenceLoading] = useState(false);
  const [confidenceError, setConfidenceError] = useState<string | null>(null);
  const [draggingKey, setDraggingKey] = useState<CriterionKey | null>(null);
  const [newSubtask, setNewSubtask] = useState("");
  const titleRef = useRef<HTMLTextAreaElement>(null);

  if ((task?.id ?? null) !== prevTaskId) {
    setPrevTaskId(task?.id ?? null);
    setConfirmingDelete(false);
    setShowExplanation(false);
    setEditingCriteria(false);
    setDraft(null);
    setRecalcError(null);
    setAnsweringConfidence(false);
    setConfidenceAnswer("");
    setConfidenceError(null);
    setShowDatePicker(false);
    setScheduleTime("");
    setCalError(null);
    setNewSubtask("");
  }

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  // Название растёт по содержимому — иначе длинный AI-сгенерированный текст
  // обрезается внутри одной строки, а браузер добавляет собственные стрелки
  // прокрутки внутри поля вместо того, чтобы просто показать вторую строку.
  useEffect(() => {
    const el = titleRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [task?.text]);

  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }

  function handleChangeField(patch: Partial<TaskEvaluation>) {
    onChangeField(patch);
    flashSaved();
  }

  function handleManualPriority(l: PriorityLabel | null) {
    onManualPriority(l);
    flashSaved();
  }

  function handleChangeProject(projectId: string | null) {
    onChangeProject(projectId);
    flashSaved();
  }

  function openCriteriaEditor() {
    if (!task) return;
    setDraft({ value: task.value, costOfDelay: task.costOfDelay, timeSensitivity: task.timeSensitivity });
    setEditingCriteria(true);
    setRecalcError(null);
  }

  async function handleRecalculate() {
    if (!task || !draft) return;
    setRecalcLoading(true);
    setRecalcError(null);
    const res = await recalculatePriority(task.id, { ...draft, effortMinutes: task.effortMinutes });
    setRecalcLoading(false);
    if (!res.ok) {
      setRecalcError(res.error);
      return;
    }
    onChangeField({
      ...draft,
      primaryReason: res.primaryReason,
      confidence: res.confidence,
      confidenceReason: res.confidenceReason,
    } as Partial<TaskEvaluation>);
    flashSaved();
    setEditingCriteria(false);
    setDraft(null);
  }

  async function handleAnswerConfidence() {
    if (!task || !confidenceAnswer.trim()) return;
    setConfidenceLoading(true);
    setConfidenceError(null);
    const res = await answerConfidenceQuestion(task.id, confidenceAnswer.trim());
    setConfidenceLoading(false);
    if (!res.ok) {
      setConfidenceError(res.error);
      return;
    }
    const t = res.task;
    onChangeField({
      value: t.value,
      costOfDelay: t.costOfDelay,
      urgency: t.timeSensitivity,
      timeSensitivity: t.timeSensitivity,
      effortMinutes: t.effortMinutes,
      confidence: t.confidence,
      confidenceReason: t.confidenceReason || null,
      deadline: t.deadline ? new Date(`${t.deadline}T00:00:00.000Z`) : null,
      primaryReason: t.primaryReason,
      riskText: t.riskText,
      aiValue: t.value,
      aiCostOfDelay: t.costOfDelay,
      aiTimeSensitivity: t.timeSensitivity,
      aiEffortMinutes: t.effortMinutes,
      aiReasoningValue: t.reasoningValue || null,
      aiReasoningCostOfDelay: t.reasoningCostOfDelay || null,
      aiReasoningTimeSensitivity: t.reasoningTimeSensitivity || null,
      aiReasoningEffort: t.reasoningEffort || null,
    } as Partial<TaskEvaluation>);
    flashSaved();
    setAnsweringConfidence(false);
    setConfidenceAnswer("");
  }

  if (!task) return null;
  const { label, aiLabel, isManual, scorePercent } = computePriority(task);

  async function handleAddToCalendar() {
    if (!onAddToCalendar || !task) return;
    const date = task.date ? toDateInput(task.date) : task.deadline ? toDateInput(task.deadline) : toDateInput(new Date());
    setCalSaving(true);
    setCalError(null);
    const res = await onAddToCalendar(date, calTime, task.effortMinutes);
    setCalSaving(false);
    if (!res.ok) setCalError(res.error ?? "Не удалось добавить событие.");
  }

  // Перенос на произвольную дату — день задачи и время в Google Calendar это
  // раньше были два отдельных шага (сначала "Выбрать дату", потом отдельно
  // включить чекбокс календаря). Если время уже указано тут же, применяем оба
  // сразу одним действием.
  async function handleConfirmCustomDate() {
    if (!scheduleDate || !task) return;
    onScheduleDate?.(scheduleDate);
    flashSaved();
    if (googleConnected && scheduleTime && onAddToCalendar) {
      setCalSaving(true);
      setCalError(null);
      const res = await onAddToCalendar(scheduleDate, scheduleTime, task.effortMinutes);
      setCalSaving(false);
      if (!res.ok) setCalError(res.error ?? "Не удалось добавить событие.");
    }
  }

  function handleToggleCalendar(checked: boolean) {
    if (checked) {
      handleAddToCalendar();
    } else {
      onRemoveFromCalendar?.();
    }
  }

  const effortAi = task.aiEffortMinutes ?? null;
  const effortChanged = effortAi !== null && effortAi !== task.effortMinutes;
  const effortSource = effortAi === null ? "введено вами" : effortChanged ? null : "оценка AI";

  const todayD = todayDate();
  const tomorrowD = tomorrowDate();
  const isScheduledToday = task.date ? sameDate(task.date, todayD) : false;
  const isScheduledTomorrow = task.date ? sameDate(task.date, tomorrowD) : false;
  const isCustomDate = Boolean(task.date) && !isScheduledToday && !isScheduledTomorrow;

  const calendarDateSource = task.date ?? task.deadline ?? todayD;
  const calendarDateLabel = `${formatDateHuman(calendarDateSource)}${
    sameDate(calendarDateSource, todayD) ? " (сегодня)" : sameDate(calendarDateSource, tomorrowD) ? " (завтра)" : ""
  }`;

  return (
    <div
      // items-start везде (не sm:items-center) — центрированный flex-контейнер с overflow
      // обрезает свой верх недостижимо для скролла, если контент перерастает экран
      // (например, после раскрытия критериев или длинного списка подзадач).
      className="fixed inset-0 bg-black/30 z-40 flex items-start justify-center p-0 sm:p-4 sm:py-8 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-2xl shadow-xl w-full sm:max-w-2xl min-h-full sm:min-h-0 sm:my-8 p-5 sm:p-7 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2">
          <div className="flex-1 flex items-start gap-2 border border-neutral-300 rounded-xl px-3.5 py-3">
            <textarea
              ref={titleRef}
              value={task.text}
              onChange={(e) => { onChangeText(e.target.value); flashSaved(); }}
              rows={1}
              className="flex-1 text-lg font-semibold border-none outline-none resize-none bg-transparent"
            />
            <button
              type="button"
              onClick={() => titleRef.current?.focus()}
              className="text-neutral-300 hover:text-neutral-500 shrink-0 mt-0.5"
              aria-label="Редактировать название"
              tabIndex={-1}
            >
              ✎
            </button>
          </div>
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800 text-xl leading-none shrink-0 p-1">
            ×
          </button>
        </div>

        <p
          className={`text-[11px] text-emerald-600 h-4 transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
          aria-live="polite"
        >
          ✓ Сохранено
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Проект</label>
            <div className="relative">
              <IconFolder className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <select
                value={task.projectId ?? ""}
                onChange={(e) => handleChangeProject(e.target.value || null)}
                className="w-full appearance-none border border-neutral-300 rounded-xl pl-9 pr-8 py-2.5 text-sm bg-white"
              >
                <option value="">Без проекта</option>
                {projectOptions.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
              <IconChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Приоритет</label>
            <div className="grid grid-cols-2 gap-1.5">
              {MAIN_LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleManualPriority(l === aiLabel && !isManual ? null : l)}
                  className={`flex items-center justify-center gap-1.5 text-sm px-2.5 py-2.5 rounded-xl border ${
                    label === l
                      ? "bg-neutral-800 text-white border-neutral-800"
                      : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                  title={PRIORITY_LABEL_HINT[l]}
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[l]}`} />
                  {SHORT_LABEL[l]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => handleManualPriority(label === "LATER" ? null : "LATER")}
              className={`mt-1.5 text-xs px-1 ${label === "LATER" ? "text-neutral-800 font-medium underline" : "text-neutral-400 hover:text-neutral-600 underline"}`}
            >
              {label === "LATER" ? "Отложено — вернуть" : "Отложить (не сейчас)"}
            </button>
          </div>
        </div>
        {isManual && (
          <p className="text-xs text-neutral-500 -mt-2">
            Изменено вручную (AI предлагал «{SHORT_LABEL[aiLabel]}»).{" "}
            <button type="button" onClick={() => handleManualPriority(null)} className="underline">
              Вернуть оценку AI
            </button>
          </p>
        )}

        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-3.5 space-y-2">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-xs font-medium text-neutral-600">
              <IconSparkle className="text-amber-500 shrink-0" />
              Почему такой приоритет?
            </p>
            <button
              type="button"
              onClick={() => (editingCriteria ? setEditingCriteria(false) : openCriteriaEditor())}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-neutral-200 text-neutral-400 hover:text-ink-600 hover:border-ink-300 shrink-0"
              title="Настроить оценку вручную"
              aria-label="Настроить оценку вручную"
            >
              ✎
            </button>
          </div>

          {task.primaryReason && (
            <button
              type="button"
              onClick={() => setShowExplanation((v) => !v)}
              className="text-sm italic text-ink-600 border-l-2 border-ink-500/30 pl-2 text-left hover:text-ink-500"
            >
              {task.primaryReason}
            </button>
          )}
          {task.riskText && (
            <p className="text-xs italic text-neutral-500 border-l-2 border-neutral-300 pl-2">
              Риск отложить: {task.riskText}
            </p>
          )}

          {showExplanation && !editingCriteria && (
            <div className="space-y-1.5 pt-1 border-t border-neutral-100">
              <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Как AI оценил задачу</p>
              {CRITERION_FIELDS.map(({ key, reasonKey }) => {
                const reasoning = task[reasonKey] as string | null | undefined;
                if (!reasoning) return null;
                return (
                  <div key={key} className="text-xs">
                    <span className="text-neutral-500 font-medium">{CRITERIA_INFO[key].title}: </span>
                    <span className="text-neutral-600">{reasoning}</span>
                  </div>
                );
              })}
              {task.projectPriority && isPriorityLabel(task.projectPriority) && task.projectPriority !== "P2" && (
                <div className="text-xs">
                  <span className="text-neutral-500 font-medium">Приоритет проекта: </span>
                  <span className="text-neutral-600">
                    {task.projectPriority === "P0" || task.projectPriority === "P1"
                      ? `выше среднего («${PRIORITY_LABEL_TEXT[task.projectPriority]}») — слегка поднимает балл`
                      : `ниже среднего («${PRIORITY_LABEL_TEXT[task.projectPriority]}») — слегка снижает балл`}
                  </span>
                </div>
              )}
            </div>
          )}

          {editingCriteria && draft && (
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500">Настроить оценку</p>
              {CRITERION_FIELDS.map(({ key }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <span className="flex items-center gap-1">
                      {CRITERIA_INFO[key].title}
                      <CriterionInfo
                        title={CRITERIA_INFO[key].title}
                        definition={CRITERIA_INFO[key].definition}
                        scale={CRITERIA_INFO[key].scale}
                      />
                    </span>
                    <span
                      className={`tabular-nums transition-all ${
                        draggingKey === key ? "text-sm font-semibold text-ink-600" : ""
                      }`}
                    >
                      {draft[key]}/5
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400">{CRITERIA_INFO[key].definition}</p>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                    onMouseDown={() => setDraggingKey(key)}
                    onTouchStart={() => setDraggingKey(key)}
                    onMouseUp={() => setDraggingKey(null)}
                    onTouchEnd={() => setDraggingKey(null)}
                    onBlur={() => setDraggingKey(null)}
                    className="w-full accent-ink-500"
                  />
                </div>
              ))}
              <p className="text-xs text-neutral-400">
                Время выполнения: ~{formatEffort(task.effortMinutes)} (не меняется здесь)
              </p>
              {recalcError && <p className="text-xs text-red-600">{recalcError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditingCriteria(false); setDraft(null); }}
                  className="flex-1 text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleRecalculate}
                  disabled={recalcLoading}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {recalcLoading ? "Пересчитываю…" : "Пересчитать"}
                </button>
              </div>
            </div>
          )}

          <div className="pt-1 border-t border-neutral-100 space-y-1.5">
            <p className="text-xs text-neutral-400 flex items-center gap-1">
              Приоритетный балл: {scorePercent}
              <CriterionInfo
                title="Приоритетный балл"
                definition="Число, по которому задачи сортируются внутри группы приоритета — чем выше, тем важнее задача среди других такого же уровня. В общем списке не показывается намеренно, чтобы не отвлекать от сути."
              />
            </p>
            {task.confidence >= LOW_CONFIDENCE_THRESHOLD ? (
              <p className="text-xs text-neutral-400 flex items-center gap-1">
                Уверенность AI: {Math.round(task.confidence * 100)}%
                <CriterionInfo
                  title="Уверенность AI"
                  definition="Насколько AI уверен в оценке этой задачи по всем критериям сразу — не оценка самой задачи, а оценка собственной оценки. Низкая уверенность означает, что в описании задачи не хватило данных, и AI попросит уточнить."
                />
              </p>
            ) : (
              <div className="text-xs bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2 space-y-1.5">
                <p className="text-amber-800 font-medium">Точно оценить нельзя — не хватает данных</p>
                <p className="text-amber-800">
                  {task.confidenceReason || "AI не пояснил, чего не хватило. Можно уточнить вручную."}
                </p>
                {answeringConfidence ? (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      autoFocus
                      value={confidenceAnswer}
                      onChange={(e) => setConfidenceAnswer(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAnswerConfidence(); }}
                      placeholder="Впишите ответ…"
                      className="w-full border border-amber-300 rounded px-2 py-1 text-xs bg-white"
                    />
                    {confidenceError && <p className="text-red-600">{confidenceError}</p>}
                    <div className="flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => { setAnsweringConfidence(false); setConfidenceAnswer(""); setConfidenceError(null); }}
                        className="px-2 py-1 rounded border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-600"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        onClick={handleAnswerConfidence}
                        disabled={confidenceLoading || !confidenceAnswer.trim()}
                        className="px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
                      >
                        {confidenceLoading ? "Анализирую…" : "Ответить"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAnsweringConfidence(true)}
                    className="text-amber-800 underline hover:text-amber-900"
                  >
                    Ответить
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <div>
          <span className="block text-xs text-neutral-500 mb-1.5">Время выполнения</span>
          <div className="flex items-center gap-2 border border-neutral-300 rounded-xl px-3 py-2.5 max-w-[12rem]">
            <IconClock className="text-neutral-400 shrink-0" />
            <input
              type="number"
              min={5}
              step={5}
              value={task.effortMinutes}
              onChange={(e) => handleChangeField({ effortMinutes: Number(e.target.value) })}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm"
            />
            <span className="text-xs text-neutral-400 shrink-0">мин</span>
          </div>
          <span className="block text-xs text-neutral-400 mt-1">
            {effortChanged ? `AI: ${formatEffort(effortAi!)}` : effortSource === "введено вами" ? "введено вами" : "оценка AI"}
          </span>
        </div>

        {(onAddSubtask || (task.subtasks && task.subtasks.length > 0)) && (
          <div>
            <label className="flex items-center justify-between text-xs text-neutral-500 mb-1.5">
              <span>Подзадачи</span>
              {task.subtasks && task.subtasks.length > 0 && (
                <span className="tabular-nums">
                  {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              )}
            </label>
            {task.subtasks && task.subtasks.length > 0 && (
              <ul className="space-y-1 mb-2">
                {task.subtasks.map((s) => (
                  <SubtaskRow
                    key={s.id}
                    subtask={s}
                    onToggle={onToggleSubtask}
                    onDelete={onDeleteSubtask}
                    onRename={onRenameSubtask}
                    onScheduleDate={onScheduleSubtask}
                  />
                ))}
              </ul>
            )}
            {onAddSubtask && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const text = newSubtask.trim();
                  if (!text) return;
                  onAddSubtask(text);
                  setNewSubtask("");
                }}
                className="flex items-center gap-2"
              >
                <input
                  type="text"
                  value={newSubtask}
                  onChange={(e) => setNewSubtask(e.target.value)}
                  placeholder="+ Добавить подзадачу"
                  className="flex-1 border border-neutral-300 rounded-lg px-2.5 py-1.5 text-sm placeholder:text-neutral-400"
                />
                <button
                  type="submit"
                  disabled={!newSubtask.trim()}
                  className="text-xs px-2.5 py-1.5 rounded-lg border border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 shrink-0"
                >
                  Добавить
                </button>
              </form>
            )}
          </div>
        )}

        <div>
          <label className="block text-xs text-neutral-500 mb-1.5">Заметка — как подступиться, что учесть</label>
          <textarea
            value={task.note ?? ""}
            onChange={(e) => handleChangeField({ note: e.target.value || null })}
            rows={2}
            placeholder="Например: начать с черновика письма, а не сразу звонить"
            className="w-full border border-neutral-300 rounded-xl px-3 py-2.5 text-sm resize-none"
          />
        </div>

        <div>
          <span className="block text-xs text-neutral-500 mb-1.5">Дедлайн</span>
          <div className="flex items-center gap-2 border border-neutral-300 rounded-xl px-3 py-2.5 max-w-xs">
            <IconCalendar className="text-neutral-400 shrink-0" />
            <input
              type="date"
              value={task.deadline ? toDateInput(task.deadline) : ""}
              onChange={(e) => handleChangeField({ deadline: e.target.value ? new Date(e.target.value) : null })}
              className="flex-1 min-w-0 border-none outline-none bg-transparent text-sm"
            />
            {task.deadline && (
              <button
                type="button"
                onClick={() => handleChangeField({ deadline: null })}
                className="text-neutral-400 hover:text-neutral-700 shrink-0"
                aria-label="Убрать дедлайн"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {(onScheduleToday || onScheduleTomorrow || onScheduleDate) && (
          <div>
            <label className="block text-xs text-neutral-500 mb-1.5">Когда выполнить</label>
            <div className="flex flex-wrap gap-2">
              {onScheduleToday && (
                <button
                  onClick={() => { onScheduleToday(); flashSaved(); }}
                  className={`flex-1 min-w-[8rem] flex items-center justify-center gap-1.5 text-sm px-2.5 py-2.5 rounded-xl border ${
                    isScheduledToday ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <IconCalendar />
                  На сегодня
                </button>
              )}
              {onScheduleTomorrow && (
                <button
                  onClick={() => { onScheduleTomorrow(); flashSaved(); }}
                  className={`flex-1 min-w-[8rem] flex items-center justify-center gap-1.5 text-sm px-2.5 py-2.5 rounded-xl border ${
                    isScheduledTomorrow ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <IconCalendar />
                  На завтра
                </button>
              )}
              {onScheduleDate && (
                <button
                  onClick={() => setShowDatePicker(true)}
                  className={`flex-1 min-w-[8rem] flex items-center justify-center gap-1.5 text-sm px-2.5 py-2.5 rounded-xl border ${
                    isCustomDate ? "bg-neutral-800 text-white border-neutral-800" : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                >
                  <IconCalendar />
                  {isCustomDate && task.date ? formatDateHuman(task.date) : "Выбрать дату"}
                </button>
              )}
            </div>
            {onScheduleDate && (showDatePicker || isCustomDate) && (
              <div className="space-y-1 mt-2">
                <div className="flex flex-wrap gap-2">
                  <input
                    type="date"
                    value={scheduleDate}
                    onChange={(e) => setScheduleDate(e.target.value)}
                    className="flex-1 min-w-[9rem] border border-neutral-300 rounded-xl px-3 py-2 text-sm"
                  />
                  {googleConnected && (
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      title="Необязательно — если указать, сразу создаст событие в Google Календаре на это время"
                      className="w-24 border border-neutral-300 rounded-xl px-2 py-2 text-sm"
                    />
                  )}
                  <button
                    onClick={handleConfirmCustomDate}
                    disabled={!scheduleDate || calSaving}
                    className="text-sm px-3 py-2 rounded-xl border border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 shrink-0"
                  >
                    {calSaving ? "Сохраняю…" : "На дату"}
                  </button>
                </div>
                {googleConnected && (
                  <p className="text-[11px] text-neutral-400">Время — необязательно, добавит событие в Google Календарь</p>
                )}
              </div>
            )}
          </div>
        )}

        {googleConnected && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(task.googleEventUrl)}
                  disabled={calSaving}
                  onChange={(e) => handleToggleCalendar(e.target.checked)}
                  className="accent-ink-500"
                />
                <IconCalendar className="text-neutral-500" />
                Добавить в Google Календарь
              </label>
              {task.googleEventUrl ? (
                <a href={task.googleEventUrl} target="_blank" rel="noreferrer" className="text-xs underline text-ink-600">
                  Открыть событие →
                </a>
              ) : (
                <span className="text-xs text-neutral-500 flex items-center gap-1.5">
                  в
                  <input
                    type="time"
                    value={calTime}
                    onChange={(e) => setCalTime(e.target.value)}
                    className="border border-neutral-300 rounded px-1.5 py-0.5 text-xs"
                  />
                  · {calendarDateLabel}
                </span>
              )}
            </div>
            {calError && <p className="text-xs text-red-600">{calError}</p>}
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
          {confirmingDelete ? (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-neutral-600">Удалить задачу?</span>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
              >
                Отмена
              </button>
              <button
                onClick={onDelete}
                className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
              >
                Удалить
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-600 hover:underline"
            >
              <IconTrash />
              Удалить задачу
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            className="text-sm px-4 py-2 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700"
          >
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
