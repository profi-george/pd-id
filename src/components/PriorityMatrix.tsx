"use client";

import { useState, useTransition } from "react";
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
  rank,
  color,
  onOpen,
}: {
  task: MatrixTask;
  rank: number;
  color: PriorityLabel;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      draggable
      onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
      className={`w-full text-left pl-2.5 pr-3 py-2.5 border-l-2 ${BORDER_CLASS[color]} hover:bg-neutral-50 flex gap-2 cursor-pointer`}
    >
      <span className="text-xs text-neutral-300 tabular-nums shrink-0 pt-0.5">{rank}</span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <p className="text-sm text-neutral-800 truncate">{task.text}</p>
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <span>{formatEffort(task.effortMinutes)}</span>
          {task.projectName && (
            <span className="text-neutral-600 truncate max-w-[160px]" title={task.projectName}>
              · {task.projectName}
            </span>
          )}
          {task.confidence < 0.6 && (
            <span className="text-amber-600 shrink-0">· AI не уверен</span>
          )}
        </div>
        {task.primaryReason && (
          <p className="text-xs italic text-ink-600/70 border-l border-ink-500/25 pl-2 mt-0.5 truncate">
            {task.primaryReason}
          </p>
        )}
      </div>
    </button>
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
  const [, startTransition] = useTransition();

  // Server-компонент передаёт свежие данные при каждой навигации/revalidate —
  // синхронизируем локальную копию, иначе после мягкого перехода видно старое.
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems(tasks);
  }

  const groups: Record<PriorityLabel, MatrixTask[]> = { P0: [], P1: [], P2: [], P3: [], LATER: [] };
  for (const t of items) groups[computePriority(t).label].push(t);
  for (const label of [...COLUMN_ORDER, "LATER" as const]) {
    groups[label].sort((a, b) => computePriority(b).score - computePriority(a).score);
  }

  function patch(id: string, p: Partial<MatrixTask>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    setOpenId(null);
    startTransition(() => { deleteTask(id); });
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
    <div className="space-y-5">
      {COLUMN_ORDER.filter((label) => groups[label].length > 0).map((label) => (
        <div key={label}>
          <div className="flex items-center gap-1.5 px-1 mb-1">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS[label]}`} />
            <p className="text-xs font-semibold text-neutral-600">
              {PRIORITY_LABEL_TEXT[label]}
            </p>
          </div>
          <div className="divide-y divide-neutral-100 bg-white border border-neutral-200 rounded-lg overflow-hidden">
            {groups[label].map((t, i) => (
              <TaskRow key={t.id} task={t} rank={i + 1} color={label} onOpen={() => setOpenId(t.id)} />
            ))}
          </div>
        </div>
      ))}

      {groups.LATER.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 px-1 mb-1">
            <span className={`w-2 h-2 rounded-full ${DOT_CLASS.LATER}`} />
            <p className="text-xs font-semibold text-neutral-500">
              {PRIORITY_LABEL_TEXT.LATER} · {groups.LATER.length}
            </p>
          </div>
          <div className="divide-y divide-neutral-100 bg-neutral-50 border border-neutral-200 rounded-lg overflow-hidden">
            {laterVisible.map((t, i) => (
              <TaskRow key={t.id} task={t} rank={i + 1} color="LATER" onOpen={() => setOpenId(t.id)} />
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
          patch(openId, { manualPriority: label });
          startTransition(() => { setManualPriority(openId, label); });
        }}
        onDelete={() => openId && handleDelete(openId)}
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
    </div>
  );
}
