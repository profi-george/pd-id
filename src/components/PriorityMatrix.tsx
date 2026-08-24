"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import {
  deleteTask,
  scheduleTask,
  setManualPriority,
  reorderPriorityTask,
  updateTaskFields,
  addTaskToGoogleCalendar,
  removeTaskFromGoogleCalendar,
} from "@/app/(app)/actions";
import TaskDrawer, { type DrawerTask } from "@/components/TaskDrawer";

export type MatrixTask = TaskEvaluation & {
  id: string;
  text: string;
  projectId: string | null;
  projectName: string | null;
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

function TaskRow({
  task,
  color,
  onOpen,
  onDropBefore,
}: {
  task: MatrixTask;
  color: PriorityLabel;
  onOpen: () => void;
  onDropBefore: (draggedId: string, before: boolean) => void;
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
        const draggedId = e.dataTransfer.getData("text/plain");
        const before = dragOver !== "bottom";
        setDragOver(null);
        if (draggedId) onDropBefore(draggedId, before);
      }}
      className={`relative border-l-2 ${BORDER_CLASS[color]} ${
        dragOver === "top" ? "border-t-2 border-t-ink-500" : dragOver === "bottom" ? "border-b-2 border-b-ink-500" : ""
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left px-3.5 py-3 hover:bg-neutral-50 cursor-grab active:cursor-grabbing space-y-1"
      >
        <p className="text-[15px] font-medium text-neutral-900 leading-snug">{task.text}</p>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-neutral-500">
          {task.projectName && <span>{task.projectName}</span>}
          <span className={task.projectName ? "text-neutral-400" : ""}>≈ {formatEffort(task.effortMinutes)}</span>
          {task.confidence < 0.6 && <span className="text-amber-600">· AI не уверен</span>}
        </div>
        {task.primaryReason && (
          <p className="text-xs text-neutral-400 leading-snug">{task.primaryReason}</p>
        )}
      </button>
    </div>
  );
}

export default function PriorityMatrix({
  tasks,
  projectOptions,
  googleConnected = false,
}: {
  tasks: MatrixTask[];
  projectOptions: { id: string; label: string }[];
  googleConnected?: boolean;
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

  function handleSchedule(id: string, target: "today" | "tomorrow") {
    setItems((prev) => prev.filter((t) => t.id !== id));
    setOpenId(null);
    startTransition(() => { scheduleTask(id, target); });
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
