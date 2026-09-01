"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  LOW_CONFIDENCE_THRESHOLD,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import { formatDateRelative, parseDateInputValue } from "@/lib/dates";
import { tasksWord } from "@/lib/pluralize";
import {
  deleteTask,
  completeTask,
  revertTaskStatus,
  undoMoveTask,
  scheduleTask,
  scheduleTaskToDate,
  unscheduleTask,
  setManualPriority,
  assignTaskToProject,
  reorderPriorityTask,
  updateTaskFields,
  addTaskToGoogleCalendar,
  removeTaskFromGoogleCalendar,
  addSubtask,
  toggleSubtask,
  renameSubtask,
  deleteSubtask,
  scheduleSubtask,
  splitPartialTask,
} from "@/app/(app)/actions";
import TaskDrawer, { type DrawerTask, type SubtaskItem } from "@/components/TaskDrawer";
import PartialCompleteDialog from "@/components/PartialCompleteDialog";

export type MatrixTask = TaskEvaluation & {
  id: string;
  text: string;
  status?: string;
  projectId: string | null;
  projectName: string | null;
  date?: Date | null;
  movedToDate?: Date | null;
  subtasks?: SubtaskItem[];
  manualRank?: number | null;
  confidenceReason?: string | null;
  googleEventId?: string | null;
  googleEventUrl?: string | null;
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
};

const COLUMN_ORDER: PriorityLabel[] = ["P0", "P1", "P2", "P3"];

const DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

const BORDER_CLASS: Record<PriorityLabel, string> = {
  P0: "border-l-red-400",
  P1: "border-l-amber-400",
  P2: "border-l-blue-300",
  P3: "border-l-neutral-300",
  LATER: "border-l-neutral-200",
};

// Рамка hero-карточки "Сейчас" берёт цвет из приоритета САМОЙ задачи вместо
// фиксированного индиго — точка приоритета и обводка карточки говорят одно
// и то же, а не спорят двумя разными акцентами.
const HERO_RING_CLASS: Record<PriorityLabel, string> = {
  P0: "border-red-400 bg-red-50/50",
  P1: "border-amber-400 bg-amber-50/50",
  P2: "border-blue-300 bg-blue-50/50",
  P3: "border-neutral-300 bg-neutral-50",
  LATER: "border-neutral-300 bg-neutral-50",
};

const GROUP_PREVIEW = 3;

// Раньше клик по этой иконке сразу переносил задачу на завтра — молча, без
// возможности передумать или выбрать другой день. Перенос это решение не менее
// значимое, чем сама дата выполнения, поэтому здесь тот же принцип, что и в
// карточке задачи: явный выбор — "Завтра" или конкретная дата, не автоматика.
function MovePicker({
  onScheduleTomorrow,
  onScheduleDate,
}: {
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
}) {
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
    <span ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-7 h-7 flex items-center justify-center rounded text-neutral-400 hover:text-ink-600 hover:bg-neutral-100"
        aria-label="Перенести"
        title="Перенести"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="3" width="9.5" height="9.5" rx="1.5" />
          <path d="M1.5 6h9.5M4.25 1.5v3" />
          <path d="M11 8.5l3 2-3 2" />
        </svg>
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 top-8 z-20 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-sm space-y-1.5"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onScheduleTomorrow(); }}
            className="w-full text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 text-left"
          >
            Завтра
          </button>
          <input
            type="date"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (!e.target.value) return;
              setOpen(false);
              onScheduleDate(e.target.value);
            }}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-xs"
          />
        </div>
      )}
    </span>
  );
}

function QuickMenu({
  status,
  scheduled,
  onDelete,
  onUnschedule,
  onComplete,
  onRevert,
  onScheduleTomorrow,
  onScheduleDate,
  onPartialComplete,
  hideCheckToggle = false,
}: {
  status?: string;
  scheduled: boolean;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
  onRevert: () => void;
  onScheduleTomorrow?: () => void;
  onScheduleDate?: (dateISO: string) => void;
  onPartialComplete?: () => void;
  // На hero-карточке ("Сейчас") отметка о выполнении уже есть отдельной крупной
  // кнопкой в теле карточки — второй маленький ✓ в этом меню был бы дублем.
  hideCheckToggle?: boolean;
}) {
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

  // Отметить/снять отметку — переключатель между PLANNED и DONE/PARTIAL. Для
  // "не выполнена"/"перенесена" тут кнопки нет намеренно: снятие статуса там
  // задевает вторую запись (дубликат на другом дне) или данные "Итога дня",
  // это отдельное, более осторожное действие, не однокликовое.
  const canToggle = status === "PLANNED" || status === "DONE" || status === "PARTIAL" || status === undefined;

  return (
    <span className="flex items-center shrink-0">
      {canToggle && !hideCheckToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (status === "DONE" || status === "PARTIAL") onRevert(); else onComplete(); }}
          className={`w-7 h-7 flex items-center justify-center rounded ${
            status === "DONE" || status === "PARTIAL"
              ? "text-emerald-600 hover:bg-emerald-50"
              : "text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50"
          }`}
          aria-label={status === "DONE" || status === "PARTIAL" ? "Вернуть в план" : "Выполнено"}
          title={status === "DONE" || status === "PARTIAL" ? "Вернуть в план" : "Отметить выполненной"}
        >
          ✓
        </button>
      )}
      {canToggle && onScheduleTomorrow && onScheduleDate && (
        <MovePicker onScheduleTomorrow={onScheduleTomorrow} onScheduleDate={onScheduleDate} />
      )}
      <span ref={ref} className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="w-7 h-7 flex items-center justify-center rounded text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          aria-label="Действия"
        >
          ⋯
        </button>
        {open && (
          <div className="absolute right-0 top-8 z-20 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm">
            {scheduled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onUnschedule(); }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-neutral-700"
              >
                Убрать из плана
              </button>
            )}
            {canToggle && onPartialComplete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPartialComplete(); }}
                className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-neutral-700"
              >
                Частично выполнено…
              </button>
            )}
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-red-600"
            >
              Удалить
            </button>
          </div>
        )}
      </span>
    </span>
  );
}

const PRIORITY_OPTIONS: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];

// Смена приоритета одним тапом прямо в списке — не открывая карточку задачи.
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
    <span ref={ref} className="relative shrink-0 pl-2 pt-3">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="flex items-center justify-center w-7 h-7 rounded-full hover:bg-neutral-100"
        aria-label={`Приоритет: ${PRIORITY_LABEL_TEXT[label]}. Изменить`}
        title={`Приоритет: ${PRIORITY_LABEL_TEXT[label]}`}
      >
        <span className={`w-2.5 h-2.5 rounded-full ${DOT_CLASS[label]}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-7 z-20 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm">
          {PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(l); }}
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

// Смена проекта одним тапом прямо в списке — не открывая карточку задачи.
function ProjectPicker({
  projectId,
  projectName,
  options,
  onPick,
}: {
  projectId: string | null;
  projectName: string | null;
  options: { id: string; label: string }[];
  onPick: (projectId: string | null) => void;
}) {
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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`hover:underline hover:text-neutral-700 -my-1 py-1 ${projectName ? "" : "text-neutral-400"}`}
      >
        {projectName ?? "+ проект"}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-48 max-h-64 overflow-y-auto bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(null); }}
            className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 ${!projectId ? "font-medium text-neutral-900" : "text-neutral-700"}`}
          >
            Без проекта
          </button>
          {options.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(p.id); }}
              className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 truncate ${
                p.id === projectId ? "font-medium text-neutral-900" : "text-neutral-700"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Смена даты одним тапом прямо в списке — не открывая карточку задачи.
function DatePicker({
  date,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
}: {
  date: Date | null | undefined;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
}) {
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
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`hover:underline hover:text-neutral-700 -my-1 py-1 ${date ? "text-ink-600" : "text-neutral-400"}`}
      >
        {date ? `· на ${formatDateRelative(date)}` : "+ дата"}
      </button>
      {open && (
        <div className="absolute left-0 top-6 z-20 w-48 bg-white border border-neutral-200 rounded-lg shadow-lg p-2 text-sm space-y-1.5">
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onScheduleToday(); }}
              className="flex-1 text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onScheduleTomorrow(); }}
              className="flex-1 text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
            >
              Завтра
            </button>
          </div>
          <input
            type="date"
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              if (!e.target.value) return;
              setOpen(false);
              onScheduleDate(e.target.value);
            }}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-xs"
          />
        </div>
      )}
    </span>
  );
}

function TaskRow({
  task,
  color,
  projectOptions,
  onOpen,
  onDropBefore,
  onDelete,
  onUnschedule,
  onComplete,
  onRevert,
  onUndoMove,
  onManualPriority,
  onAssignProject,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
  selected,
  onToggleSelect,
  onPartialComplete,
  hero = false,
}: {
  task: MatrixTask;
  color: PriorityLabel;
  projectOptions: { id: string; label: string }[];
  onOpen: () => void;
  onDropBefore: (draggedId: string, before: boolean) => void;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
  onRevert: () => void;
  onUndoMove: () => Promise<boolean>;
  onManualPriority: (label: PriorityLabel) => void;
  onAssignProject: (projectId: string | null) => void;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
  selected: boolean;
  onToggleSelect: () => void;
  onPartialComplete: () => void;
  // Карточка "Сейчас" наверху экрана дня: крупная кнопка выполнения и балл
  // приоритета видны сразу, без похода в детали задачи.
  hero?: boolean;
}) {
  const [dragOver, setDragOver] = useState<"top" | "bottom" | null>(null);
  // Быстрые правки прямо в списке (приоритет/проект/дата) иначе проходят молча —
  // секундная сетевая заминка выглядела бы точно как сбой. Короткая вспышка "✓"
  // подтверждает, что тап действительно принят, тем же языком, что уже есть
  // в карточке задачи ("✓ Сохранено").
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  function triggerFlash() {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1200);
  }

  // Отмена переноса — своё состояние: пока ждём ответ сервера, кнопка неактивна;
  // если копию уже успели изменить, отменить нельзя — показываем это тут же,
  // рядом с местом, где человек об этом узнаёт, а не в общем алерте.
  const [undoMoveState, setUndoMoveState] = useState<"idle" | "pending" | "error">("idle");
  async function handleUndoMoveClick() {
    setUndoMoveState("pending");
    const ok = await onUndoMove();
    setUndoMoveState(ok ? "idle" : "error");
  }

  return (
    <div
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOver(e.clientY < rect.top + rect.height / 2 ? "top" : "bottom");
      }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation(); // иначе drop всплывает до контейнера группы и тот перебивает вставку, всегда добавляя в конец
        const draggedId = e.dataTransfer.getData("text/plain");
        const before = dragOver !== "bottom";
        setDragOver(null);
        if (draggedId) onDropBefore(draggedId, before);
      }}
      className={`group relative border-l-2 ${hero ? "border-l-transparent" : BORDER_CLASS[color]} flex items-start ${
        dragOver === "top" ? "border-t-2 border-t-ink-500" : dragOver === "bottom" ? "border-b-2 border-b-ink-500" : ""
      }`}
    >
      <label
        className="pt-4 pl-2 pr-0.5 shrink-0 self-start"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          // Тише по умолчанию — редкий сценарий, не должен спорить за внимание
          // с остальной строкой; проявляется при наведении, фокусе или выборе.
          className="accent-ink-500 opacity-30 checked:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          aria-label="Выбрать задачу"
        />
      </label>
      <PriorityPicker label={color} onPick={(l) => { onManualPriority(l); triggerFlash(); }} />
      <div
        role="button"
        tabIndex={0}
        onClick={onOpen}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className="flex-1 min-w-0 text-left pr-3.5 py-3 hover:bg-neutral-50 cursor-grab active:cursor-grabbing space-y-1"
      >
        <p
          className={`text-[15px] font-medium leading-snug ${
            task.status === "MOVED"
              ? "line-through text-neutral-400"
              : task.status === "NOT_DONE"
              ? "text-neutral-500"
              : "text-neutral-900"
          }`}
        >
          {task.text}
        </p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
          {task.subtasks && task.subtasks.length > 0 && (
            <span
              className={`tabular-nums ${
                task.subtasks.every((s) => s.done) ? "text-emerald-600" : ""
              }`}
            >
              ☑ {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
            </span>
          )}
          <ProjectPicker
            projectId={task.projectId}
            projectName={task.projectName}
            options={projectOptions}
            onPick={(id) => { onAssignProject(id); triggerFlash(); }}
          />
          <span className={task.projectName ? "text-neutral-400" : ""}>≈ {formatEffort(task.effortMinutes)}</span>
          <DatePicker
            date={task.date}
            onScheduleToday={() => { onScheduleToday(); triggerFlash(); }}
            onScheduleTomorrow={() => { onScheduleTomorrow(); triggerFlash(); }}
            onScheduleDate={(d) => { onScheduleDate(d); triggerFlash(); }}
          />
        </div>
        {(task.status === "DONE" ||
          task.status === "NOT_DONE" ||
          task.status === "MOVED" ||
          task.status === "PARTIAL" ||
          task.confidence < LOW_CONFIDENCE_THRESHOLD ||
          flash) && (
          <div className="flex flex-wrap items-center gap-1 text-[11px]">
            {task.status === "DONE" && (
              <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">выполнена</span>
            )}
            {task.status === "PARTIAL" && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-700">
                частично{task.movedToDate ? ` · продолжение → ${formatDateRelative(task.movedToDate)}` : ""}
              </span>
            )}
            {task.status === "NOT_DONE" && (
              <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500">не выполнена</span>
            )}
            {task.status === "MOVED" && undoMoveState !== "error" && (
              <span className="px-1.5 py-0.5 rounded-full bg-neutral-100 text-neutral-500 inline-flex items-center gap-1">
                перенесена{task.movedToDate ? ` → ${formatDateRelative(task.movedToDate)}` : ""}
                <button
                  type="button"
                  disabled={undoMoveState === "pending"}
                  onClick={(e) => { e.stopPropagation(); handleUndoMoveClick(); }}
                  className="underline hover:text-neutral-700 disabled:opacity-50"
                >
                  {undoMoveState === "pending" ? "отменяю…" : "отменить"}
                </button>
              </span>
            )}
            {task.status === "MOVED" && undoMoveState === "error" && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">
                перенос уже нельзя отменить — копия изменена
              </span>
            )}
            {task.confidence < LOW_CONFIDENCE_THRESHOLD && (
              <span className="px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700">AI не уверен</span>
            )}
            {flash && <span className="px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700">✓ Сохранено</span>}
          </div>
        )}
        {task.primaryReason && (
          <p className="text-xs italic text-ink-600/70 border-l border-ink-500/25 pl-2 leading-snug">
            {task.primaryReason}
          </p>
        )}
        {task.note && (
          <p className="text-xs text-neutral-500 border-l border-neutral-300 pl-2 leading-snug">
            {task.note}
          </p>
        )}
        {hero && (task.status === "PLANNED" || task.status === undefined || task.status === "DONE" || task.status === "PARTIAL") && (
          <div className="pt-1.5" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { if (task.status === "DONE" || task.status === "PARTIAL") onRevert(); else onComplete(); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                task.status === "DONE" || task.status === "PARTIAL"
                  ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
              }`}
            >
              {task.status === "DONE" || task.status === "PARTIAL" ? "✓ Выполнено — вернуть в план" : "Выполнить"}
            </button>
          </div>
        )}
      </div>
      <div className="pt-1.5 pr-1.5 flex items-center gap-1">
        {hero && (
          <span
            className="mr-0.5 w-9 h-9 rounded-full border-2 border-ink-400 bg-white flex items-center justify-center text-ink-700 shrink-0 tabular-nums"
            title="Приоритетный балл"
          >
            <span className="text-xs font-bold leading-none">{computePriority(task).scorePercent}</span>
          </span>
        )}
        <QuickMenu
          status={task.status}
          scheduled={Boolean(task.date)}
          onDelete={onDelete}
          onUnschedule={onUnschedule}
          onComplete={onComplete}
          onRevert={onRevert}
          onScheduleTomorrow={() => { onScheduleTomorrow(); triggerFlash(); }}
          onScheduleDate={(d) => { onScheduleDate(d); triggerFlash(); }}
          onPartialComplete={onPartialComplete}
          hideCheckToggle={hero}
        />
      </div>
    </div>
  );
}

export default function PriorityMatrix({
  tasks,
  projectOptions,
  googleConnected = false,
  planView = false,
  removeOnSchedule = false,
  emptyMessage = "Здесь пока пусто.",
  showTopPick = false,
}: {
  tasks: MatrixTask[];
  projectOptions: { id: string; label: string }[];
  googleConnected?: boolean;
  // true на странице "План дня": список — только задачи конкретной даты, поэтому
  // "убрать из плана" должно сразу убрать карточку из вида, а не просто снять дату.
  planView?: boolean;
  // true на «Задачах» (Бэклог): список — только нераспределённые (без даты), поэтому
  // назначение ЛЮБОЙ даты уводит задачу из этого списка в «План дня» той даты.
  removeOnSchedule?: boolean;
  // Пустое состояние разное по смыслу на разных экранах (план дня / задачи /
  // проект) — общее "Здесь пока пусто" не объясняет, что делать дальше.
  emptyMessage?: string;
  // Экран дня: выносит самую приоритетную активную задачу отдельным блоком
  // наверх — после её выполнения следующая по очереди сама займёт то же место,
  // без дополнительных действий.
  showTopPick?: boolean;
}) {
  const [items, setItems] = useState(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [openId, setOpenId] = useState<string | null>(null);
  // Раскрытие длинного хвоста списка LATER — единственная группа, которую прячем
  // за "Показать ещё"; P0–P3 показываются целиком, одним стеком секций.
  const [laterExpanded, setLaterExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ task: MatrixTask; timer: ReturnType<typeof setTimeout> } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [partialTaskId, setPartialTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const pendingDeleteRef = useRef(pendingDelete);
  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);

  // Server-компонент передаёт свежие данные при каждой навигации/revalidate —
  // синхронизируем локальную копию, иначе после мягкого перехода видно старое.
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems(tasks);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    return () => {
      // Если ушли со страницы с "висящим" удалением — не теряем его молча.
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timer);
        deleteTask(pendingDeleteRef.current.task.id);
      }
    };
  }, []);

  const groups: Record<PriorityLabel, MatrixTask[]> = { P0: [], P1: [], P2: [], P3: [], LATER: [] };
  for (const t of items) groups[computePriority(t).label].push(t);
  for (const label of [...COLUMN_ORDER, "LATER" as const]) {
    groups[label].sort((a, b) => {
      const ra = a.manualRank ?? Infinity;
      const rb = b.manualRank ?? Infinity;
      if (ra !== rb) return ra - rb;
      return computePriority(b).score - computePriority(a).score;
    });
  }

  // "Сейчас" — первая ещё активная задача по уже посчитанному порядку (тому же,
  // что определяет группы выше). LATER сознательно не участвует — эти задачи не
  // должны попадать в фокус только потому, что больше ничего активного не осталось.
  let topTask: MatrixTask | null = null;
  if (showTopPick) {
    for (const label of COLUMN_ORDER) {
      const found = groups[label].find((t) => t.status === "PLANNED" || t.status === undefined);
      if (found) { topTask = found; break; }
    }
  }

  function patch(id: string, p: Partial<MatrixTask>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }

  // Смена приоритета прямо в списке (не через карточку задачи) — тот же ручной override,
  // что и в TaskDrawer, только без похода в карточку.
  function handleManualPriority(id: string, label: PriorityLabel) {
    patch(id, { manualPriority: label, manualRank: null });
    startTransition(() => { setManualPriority(id, label); });
  }

  // Смена проекта прямо в списке (не через карточку задачи).
  function handleAssignProject(id: string, projectId: string | null) {
    const label = projectOptions.find((p) => p.id === projectId)?.label ?? null;
    const projectName = label ? label.replace(/^(— )+/, "") : null;
    patch(id, { projectId, projectName });
    startTransition(() => { assignTaskToProject(id, projectId); });
  }

  // Перетаскивание внутри группы и между группами. referenceId — задача, рядом с которой
  // бросили (null = в конец группы/на пустую группу), before — вставить до/после неё.
  function moveTask(targetGroup: PriorityLabel, referenceId: string | null, before: boolean, draggedId: string) {
    if (draggedId === referenceId) return;
    const currentTargetOrder = groups[targetGroup].filter((t) => t.id !== draggedId).map((t) => t.id);
    let insertIdx = currentTargetOrder.length;
    if (referenceId) {
      const refIdx = currentTargetOrder.indexOf(referenceId);
      if (refIdx !== -1) insertIdx = before ? refIdx : refIdx + 1;
    }
    const newOrder = [...currentTargetOrder];
    newOrder.splice(insertIdx, 0, draggedId);

    setItems((prev) =>
      prev.map((t) => {
        const idx = newOrder.indexOf(t.id);
        if (idx === -1) return t;
        return t.id === draggedId
          ? { ...t, manualPriority: targetGroup, manualRank: idx }
          : { ...t, manualRank: idx };
      })
    );
    startTransition(() => {
      reorderPriorityTask(draggedId, targetGroup, newOrder);
    });
  }

  function flushPendingDelete() {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    startTransition(() => { deleteTask(pending.task.id); });
    setPendingDelete(null);
  }

  function handleDeleteRequest(id: string) {
    const task = items.find((t) => t.id === id);
    if (!task) return;
    flushPendingDelete();
    setItems((prev) => prev.filter((t) => t.id !== id));
    setOpenId(null);
    const timer = setTimeout(() => {
      startTransition(() => { deleteTask(id); });
      setPendingDelete(null);
    }, 6000);
    setPendingDelete({ task, timer });
  }

  function undoDelete() {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    setItems((prev) => [...prev, pending.task]);
    setPendingDelete(null);
  }

  // В planView (План дня — все показанные задачи по определению одной даты) смена
  // даты уводит задачу с этой страницы. В общем списке (Все задачи/проект) она
  // остаётся видна — просто со сменившейся датой, которую подтянет ревалидация.
  function handleSchedule(id: string, target: "today" | "tomorrow") {
    if (planView || removeOnSchedule) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    }
    startTransition(() => { scheduleTask(id, target); });
  }

  function handleScheduleDate(id: string, dateISO: string) {
    if (planView || removeOnSchedule) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    }
    startTransition(() => { scheduleTaskToDate(id, dateISO); });
  }

  function handleUnschedule(id: string) {
    if (planView) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    } else {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, date: null } : t)));
    }
    startTransition(() => { unscheduleTask(id); });
  }

  function handleComplete(id: string) {
    // Не убираем из списка — задача остаётся видна в своей группе приоритета,
    // просто отмеченной. "План дня" — единый список на весь день, а не только
    // то, что ещё не сделано.
    patch(id, { status: "DONE" } as Partial<MatrixTask>);
    setOpenId(null);
    startTransition(() => { completeTask(id); });
  }

  function handleRevert(id: string) {
    patch(id, { status: "PLANNED" } as Partial<MatrixTask>);
    startTransition(() => { revertTaskStatus(id); });
  }

  async function handleUndoMove(id: string): Promise<boolean> {
    const res = await undoMoveTask(id);
    if (res.ok) patch(id, { status: "PLANNED", movedToDate: null } as Partial<MatrixTask>);
    return res.ok;
  }

  // Продолжение создаётся на сервере с новым id, которого у нас ещё нет —
  // проще убрать исходную задачу из вида (как и при обычном "На завтра") и
  // дать следующей навигации/ревалидации показать новую запись там, где ей
  // положено быть, чем пытаться на клиенте угадывать её форму.
  async function handlePartialComplete(input: { doneNote: string | null; remainingNote: string | null; newDateISO: string | null }) {
    if (!partialTaskId) return;
    const res = await splitPartialTask(partialTaskId, {
      doneNote: input.doneNote,
      remainingNote: input.remainingNote,
      newDate: input.newDateISO ? parseDateInputValue(input.newDateISO) : null,
    });
    if (res.ok) {
      setItems((prev) => prev.filter((t) => t.id !== partialTaskId));
      setPartialTaskId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  function bulkComplete() {
    const ids = Array.from(selectedIds);
    setItems((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, status: "DONE" } : t)));
    startTransition(() => { ids.forEach((id) => completeTask(id)); });
    setSelectedIds(new Set());
  }

  function bulkSchedule(target: "today" | "tomorrow") {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => handleSchedule(id, target));
    setSelectedIds(new Set());
  }

  // Массовое удаление — не переиспользуем однократный soft-undo (там всего один
  // "висящий" слот на всё сразу, при нескольких id подряд каждый следующий вызов
  // немедленно фиксирует предыдущий) — вместо этого одно явное подтверждение
  // на всю группу, это и честнее для необратимого массового действия.
  function bulkDelete() {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!confirm(`Удалить ${ids.length} ${tasksWord(ids.length)}? Это нельзя отменить.`)) return;
    setItems((prev) => prev.filter((t) => !ids.includes(t.id)));
    setOpenId(null);
    startTransition(() => { ids.forEach((id) => deleteTask(id)); });
    setSelectedIds(new Set());
  }

  const openTask = items.find((t) => t.id === openId) ?? null;
  const drawerTask: DrawerTask | null = openTask ? { ...openTask } : null;

  // Массовые действия должны быть осмысленны для того, что реально выделено —
  // иначе "Сегодня"/"Завтра" на уже выполненной задаче молча сняли бы отметку
  // "выполнено" и перенесли её, а "Выполнено" на уже готовой ничего не меняет.
  const selectedTasks = items.filter((t) => selectedIds.has(t.id));
  const canBulkComplete = selectedTasks.some((t) => t.status !== "DONE");
  const canBulkReschedule = selectedTasks.some((t) => t.status !== "DONE" && t.status !== "MOVED");

  const laterVisible = laterExpanded ? groups.LATER : groups.LATER.slice(0, GROUP_PREVIEW);

  // Общий рендер строки — переиспользуется и для "Сейчас" наверху, и для обычных
  // групп ниже, чтобы вся логика строки (клики, drag, быстрые правки) жила в одном месте.
  function renderRow(t: MatrixTask, label: PriorityLabel, hero = false) {
    return (
      <TaskRow
        key={t.id}
        task={t}
        color={label}
        hero={hero}
        onOpen={() => setOpenId(t.id)}
        onDropBefore={(draggedId, before) => moveTask(label, t.id, before, draggedId)}
        onDelete={() => handleDeleteRequest(t.id)}
        onUnschedule={() => handleUnschedule(t.id)}
        onComplete={() => handleComplete(t.id)}
        onRevert={() => handleRevert(t.id)}
        onUndoMove={() => handleUndoMove(t.id)}
        onManualPriority={(l) => handleManualPriority(t.id, l)}
        onAssignProject={(id) => handleAssignProject(t.id, id)}
        projectOptions={projectOptions}
        onScheduleToday={() => handleSchedule(t.id, "today")}
        onScheduleTomorrow={() => handleSchedule(t.id, "tomorrow")}
        onScheduleDate={(dateISO) => handleScheduleDate(t.id, dateISO)}
        selected={selectedIds.has(t.id)}
        onToggleSelect={() => toggleSelect(t.id)}
        onPartialComplete={() => setPartialTaskId(t.id)}
      />
    );
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-400 px-1">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-6">
      {topTask && (() => {
        const topLabel = computePriority(topTask).label;
        return (
          <div>
            <p className="text-xs font-semibold text-neutral-500 uppercase tracking-wide px-1 mb-1.5">Сейчас</p>
            <div className={`border-2 rounded-xl overflow-hidden ${HERO_RING_CLASS[topLabel]}`}>
              {renderRow(topTask, topLabel, true)}
            </div>
          </div>
        );
      })()}

      {COLUMN_ORDER.filter((label) => groups[label].some((t) => t.id !== topTask?.id)).map((label) => (
        <div key={label}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS[label]}`} />
            <p className="text-xs font-semibold text-neutral-600">
              {PRIORITY_LABEL_TEXT[label]} · {groups[label].filter((t) => t.id !== topTask?.id).length}
            </p>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              if (draggedId) moveTask(label, null, false, draggedId);
            }}
            className="divide-y divide-neutral-200"
          >
            {groups[label].filter((t) => t.id !== topTask?.id).map((t) => renderRow(t, label))}
          </div>
        </div>
      ))}

      {groups.LATER.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS.LATER}`} />
            <p className="text-xs font-semibold text-neutral-500">
              {PRIORITY_LABEL_TEXT.LATER} · {groups.LATER.length}
            </p>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              if (draggedId) moveTask("LATER", null, false, draggedId);
            }}
            className="divide-y divide-neutral-200"
          >
            {laterVisible.map((t) => renderRow(t, "LATER"))}
          </div>
          {groups.LATER.length > GROUP_PREVIEW && (
            <button
              type="button"
              onClick={() => setLaterExpanded((v) => !v)}
              className="text-xs text-neutral-400 hover:text-neutral-700 px-1 mt-1"
            >
              {laterExpanded ? "Свернуть" : `Показать ещё ${groups.LATER.length - GROUP_PREVIEW} →`}
            </button>
          )}
        </div>
      )}

      <TaskDrawer
        task={drawerTask}
        projectOptions={projectOptions}
        googleConnected={googleConnected}
        onClose={() => setOpenId(null)}
        onChangeText={(text) => {
          if (!openId) return;
          patch(openId, { text });
          startTransition(() => { updateTaskFields(openId, { text }); });
        }}
        onChangeProject={(projectId) => {
          if (!openId) return;
          const label = projectOptions.find((p) => p.id === projectId)?.label ?? null;
          patch(openId, { projectId, projectName: label });
          startTransition(() => { updateTaskFields(openId, { projectId }); });
        }}
        onChangeField={(fieldPatch) => {
          if (!openId) return;
          patch(openId, fieldPatch as Partial<MatrixTask>);
          startTransition(() => { updateTaskFields(openId, fieldPatch); });
        }}
        onManualPriority={(label) => {
          if (!openId) return;
          patch(openId, { manualPriority: label, manualRank: null });
          startTransition(() => { setManualPriority(openId, label); });
        }}
        onDelete={() => openId && handleDeleteRequest(openId)}
        onScheduleToday={() => openId && handleSchedule(openId, "today")}
        onScheduleTomorrow={() => openId && handleSchedule(openId, "tomorrow")}
        onScheduleDate={(dateISO) => openId && handleScheduleDate(openId, dateISO)}
        onAddToCalendar={async (date, startTime, durationMinutes) => {
          if (!openId) return { ok: false, error: "Нет открытой задачи." };
          const res = await addTaskToGoogleCalendar(openId, { date, startTime, durationMinutes });
          if (res.ok) {
            patch(openId, { googleEventUrl: res.eventUrl });
            return { ok: true };
          }
          return { ok: false, error: res.error };
        }}
        onRemoveFromCalendar={() => {
          if (!openId) return;
          patch(openId, { googleEventId: null, googleEventUrl: null });
          startTransition(() => { removeTaskFromGoogleCalendar(openId); });
        }}
        onAddSubtask={async (text) => {
          if (!openId) return;
          const created = await addSubtask(openId, text);
          if (!created) return;
          const current = items.find((t) => t.id === openId);
          patch(openId, {
            subtasks: [...(current?.subtasks ?? []), { id: created.id, text: created.text, done: created.done }],
          } as Partial<MatrixTask>);
        }}
        onToggleSubtask={(subtaskId, done) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { toggleSubtask(subtaskId, done); });
        }}
        onRenameSubtask={(subtaskId, text) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, text } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { renameSubtask(subtaskId, text); });
        }}
        onDeleteSubtask={(subtaskId) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).filter((s) => s.id !== subtaskId),
          } as Partial<MatrixTask>);
          startTransition(() => { deleteSubtask(subtaskId); });
        }}
        onScheduleSubtask={(subtaskId, dateISO) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          const date = dateISO ? parseDateInputValue(dateISO) : null;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, date } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { scheduleSubtask(subtaskId, dateISO); });
        }}
      />

      {selectedIds.size > 0 && (
        <div
          className={`fixed left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-sm rounded-full pl-4 pr-2 py-2 flex items-center gap-1.5 shadow-lg flex-wrap justify-center max-w-[calc(100vw-2rem)] transition-[bottom] ${
            pendingDelete ? "bottom-20" : "bottom-4"
          }`}
        >
          <span className="pr-1.5">{selectedIds.size} {tasksWord(selectedIds.size)}</span>
          {canBulkComplete && (
            <button type="button" onClick={bulkComplete} className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">
              Выполнено
            </button>
          )}
          {canBulkReschedule && (
            <>
              <button type="button" onClick={() => bulkSchedule("today")} className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">
                Сегодня
              </button>
              <button type="button" onClick={() => bulkSchedule("tomorrow")} className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20">
                Завтра
              </button>
            </>
          )}
          <button type="button" onClick={bulkDelete} className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-red-500/80">
            Удалить
          </button>
          <button type="button" onClick={clearSelection} className="px-2.5 py-1 rounded-full hover:bg-white/10 text-white/60">
            Отмена
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-sm rounded-full pl-4 pr-2 py-2 flex items-center gap-3 shadow-lg">
          <span>Задача удалена</span>
          <button
            type="button"
            onClick={undoDelete}
            className="px-3 py-1 rounded-full bg-white/10 hover:bg-white/20 font-medium"
          >
            Отменить
          </button>
        </div>
      )}

      {partialTaskId && (() => {
        const partialTask = items.find((t) => t.id === partialTaskId);
        if (!partialTask) return null;
        return (
          <PartialCompleteDialog
            taskText={partialTask.text}
            onClose={() => setPartialTaskId(null)}
            onSubmit={handlePartialComplete}
          />
        );
      })()}
    </div>
  );
}
