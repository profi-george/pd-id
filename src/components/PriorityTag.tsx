import { computePriority, formatEffort, PRIORITY_LABEL_TEXT, type TaskEvaluation } from "@/lib/priorityEngine";
import { IconHand } from "@/components/icons";

// Плашка приоритета: точка + название. Раньше цвет заливал всю плашку —
// на экране "Итога дня", где такие плашки стоят в каждой строке подряд,
// это давало полосу разноцветных прямоугольников, которая спорила
// с текстом задач. Теперь цвет несёт только точка, а плашка нейтральная.
const DOT_CLASS: Record<string, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

export default function PriorityTag({ task, showEffort = true }: { task: TaskEvaluation; showEffort?: boolean }) {
  const { label, isManual } = computePriority(task);
  return (
    <span className="chip bg-neutral-100 text-neutral-600 ring-1 ring-neutral-200">
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${DOT_CLASS[label]}`} />
      {PRIORITY_LABEL_TEXT[label]}
      {showEffort && <span className="text-neutral-400 tabular-nums">· {formatEffort(task.effortMinutes)}</span>}
      {isManual && <IconHand size={11} className="text-neutral-400 shrink-0" />}
      {isManual && <span className="sr-only">Приоритет изменён вручную</span>}
    </span>
  );
}
