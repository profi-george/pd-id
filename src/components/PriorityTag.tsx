import { computePriority, formatEffort, PRIORITY_LABEL_TEXT, type TaskEvaluation } from "@/lib/priorityEngine";

const LABEL_CLASS: Record<string, string> = {
  P0: "bg-red-100 text-red-700",
  P1: "bg-amber-100 text-amber-700",
  P2: "bg-blue-100 text-blue-700",
  P3: "bg-emerald-100 text-emerald-700",
  LATER: "bg-neutral-100 text-neutral-500",
};

export default function PriorityTag({ task, showEffort = true }: { task: TaskEvaluation; showEffort?: boolean }) {
  const { label, isManual } = computePriority(task);
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded ${LABEL_CLASS[label]}`}>
      {PRIORITY_LABEL_TEXT[label]}
      {showEffort && <span className="opacity-70">· {formatEffort(task.effortMinutes)}</span>}
      {isManual && <span title="Приоритет изменён вручную">✋</span>}
    </span>
  );
}
