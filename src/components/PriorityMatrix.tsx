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
import { formatDateRelative } from "@/lib/dates";
import {
  deleteTask,
  completeTask,
  revertTaskStatus,
  scheduleTask,
  scheduleTaskToDate,
  unscheduleTask,
  setManualPriority,
  assignTaskToProject,
  reorderPriorityTask,
  updateTaskFields,
  addTaskToGoogleCalendar,
  removeTaskFromGoogleCalendar,
} from "@/app/(app)/actions";
import TaskDrawer, { type DrawerTask } from "@/components/TaskDrawer";

export type MatrixTask = TaskEvaluation & {
  id: string;
  text: string;
  status?: string;
  projectId: string | null;
  projectName: string | null;
  date?: Date | null;
  movedToDate?: Date | null;
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

const LATER_PREVIEW = 3;

function QuickMenu({
  status,
  scheduled,
  onDelete,
  onUnschedule,
  onComplete,
  onRevert,
}: {
  status?: string;
  scheduled: boolean;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
  onRevert: () => void;
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

  // Отметить/снять отметку — переключатель только между PLANNED и DONE. Для
  // "не выполнена"/"перенесена" тут кнопки нет намеренно: снятие статуса там
  // задевает вторую запись (дубликат на другом дне) или данные "Итога дня",
  // это отдельное, более осторожное действие, не однокликовое.
  const canToggle = status === "PLANNED" || status === "DONE" || status === undefined;

  return (
    <span className="flex items-center shrink-0">
      {canToggle && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); if (status === "DONE") onRevert(); else onComplete(); }}
          className={`w-7 h-7 flex items-center justify-center rounded ${
            status === "DONE"
              ? "text-emerald-600 hover:bg-emerald-50"
              : "text-neutral-400 hover:text-emerald-600 hover:bg-emerald-50"
          }`}
          aria-label={status === "DONE" ? "Вернуть в план" : "Выполнено"}
          title={status === "DONE" ? "Вернуть в план" : "Отметить выполненной"}
        >
          ✓
        </button>
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
  onManualPriority,
  onAssignProject,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
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
  onManualPriority: (label: PriorityLabel) => void;
  onAssignProject: (projectId: string | null) => void;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
}) {
  const [dragOver, setDragOver] = useState<"top" | "bottom" | null>(null);

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
      className={`relative border-l-2 ${BORDER_CLASS[color]} flex items-start ${
        dragOver === "top" ? "border-t-2 border-t-ink-500" : dragOver === "bottom" ? "border-b-2 border-b-ink-500" : ""
      }`}
    >
      <PriorityPicker label={color} onPick={onManualPriority} />
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
          <ProjectPicker
            projectId={task.projectId}
            projectName={task.projectName}
            options={projectOptions}
            onPick={onAssignProject}
          />
          <span className={task.projectName ? "text-neutral-400" : ""}>≈ {formatEffort(task.effortMinutes)}</span>
          <DatePicker
            date={task.date}
            onScheduleToday={onScheduleToday}
            onScheduleTomorrow={onScheduleTomorrow}
            onScheduleDate={onScheduleDate}
          />
          {task.status === "DONE" && <span className="text-emerald-600">· выполнена</span>}
          {task.status === "NOT_DONE" && <span className="text-neutral-400">· не выполнена</span>}
          {task.status === "MOVED" && (
            <span className="text-neutral-400">
              · перенесена{task.movedToDate ? ` → ${formatDateRelative(task.movedToDate)}` : ""}
            </span>
          )}
          {task.confidence < LOW_CONFIDENCE_THRESHOLD && <span className="text-amber-600">· AI не уверен</span>}
        </div>
        {task.primaryReason && (
          <p className="text-xs italic text-ink-600/70 border-l border-ink-500/25 pl-2 leading-snug">
            {task.primaryReason}
          </p>
        )}
      </div>
      <div className="pt-1.5 pr-1.5">
        <QuickMenu
          status={task.status}
          scheduled={Boolean(task.date)}
          onDelete={onDelete}
          onUnschedule={onUnschedule}
          onComplete={onComplete}
          onRevert={onRevert}
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
}: {
  tasks: MatrixTask[];
  projectOptions: { id: string; label: string }[];
  googleConnected?: boolean;
  // true на странице "План дня": список — только задачи конкретной даты, поэтому
  // "убрать из плана" должно сразу убрать карточку из вида, а не просто снять дату.
  planView?: boolean;
}) {
  const [items, setItems] = useState(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [openId, setOpenId] = useState<string | null>(null);
  const [laterExpanded, setLaterExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ task: MatrixTask; timer: ReturnType<typeof setTimeout> } | null>(null);
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
    if (planView) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    }
    startTransition(() => { scheduleTask(id, target); });
  }

  function handleScheduleDate(id: string, dateISO: string) {
    if (planView) {
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

  const openTask = items.find((t) => t.id === openId) ?? null;
  const drawerTask: DrawerTask | null = openTask ? { ...openTask } : null;

  const laterVisible = laterExpanded ? groups.LATER : groups.LATER.slice(0, LATER_PREVIEW);

  if (items.length === 0) {
    return <p className="text-sm text-neutral-400 px-1">Здесь пока пусто.</p>;
  }

  return (
    <div className="space-y-6">
      {COLUMN_ORDER.filter((label) => groups[label].length > 0).map((label) => (
        <div key={label}>
          <div className="flex items-center gap-1.5 px-1 mb-1.5">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS[label]}`} />
            <p className="text-xs font-semibold text-neutral-600">
              {PRIORITY_LABEL_TEXT[label]} · {groups[label].length}
            </p>
          </div>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const draggedId = e.dataTransfer.getData("text/plain");
              if (draggedId) moveTask(label, null, false, draggedId);
            }}
            className="divide-y divide-neutral-100 bg-white border border-neutral-200 rounded-xl overflow-hidden"
          >
            {groups[label].map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                color={label}
                onOpen={() => setOpenId(t.id)}
                onDropBefore={(draggedId, before) => moveTask(label, t.id, before, draggedId)}
                onDelete={() => handleDeleteRequest(t.id)}
                onUnschedule={() => handleUnschedule(t.id)}
                onComplete={() => handleComplete(t.id)}
                onRevert={() => handleRevert(t.id)}
                onManualPriority={(l) => handleManualPriority(t.id, l)}
                onAssignProject={(id) => handleAssignProject(t.id, id)}
                projectOptions={projectOptions}
                onScheduleToday={() => handleSchedule(t.id, "today")}
                onScheduleTomorrow={() => handleSchedule(t.id, "tomorrow")}
                onScheduleDate={(dateISO) => handleScheduleDate(t.id, dateISO)}
              />
            ))}
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
            className="divide-y divide-neutral-100 bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden"
          >
            {laterVisible.map((t) => (
              <TaskRow
                key={t.id}
                task={t}
                color="LATER"
                onOpen={() => setOpenId(t.id)}
                onDropBefore={(draggedId, before) => moveTask("LATER", t.id, before, draggedId)}
                onDelete={() => handleDeleteRequest(t.id)}
                onUnschedule={() => handleUnschedule(t.id)}
                onComplete={() => handleComplete(t.id)}
                onRevert={() => handleRevert(t.id)}
                onManualPriority={(l) => handleManualPriority(t.id, l)}
                onAssignProject={(id) => handleAssignProject(t.id, id)}
                projectOptions={projectOptions}
                onScheduleToday={() => handleSchedule(t.id, "today")}
                onScheduleTomorrow={() => handleSchedule(t.id, "tomorrow")}
                onScheduleDate={(dateISO) => handleScheduleDate(t.id, dateISO)}
              />
            ))}
          </div>
          {groups.LATER.length > LATER_PREVIEW && (
            <button
              type="button"
              onClick={() => setLaterExpanded((v) => !v)}
              className="text-xs text-neutral-400 hover:text-neutral-700 px-1 mt-1"
            >
              {laterExpanded ? "Свернуть" : `Показать ещё ${groups.LATER.length - LATER_PREVIEW} →`}
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
      />

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
    </div>
  );
}
