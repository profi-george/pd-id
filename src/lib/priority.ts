import { computePriority, type TaskEvaluation } from "@/lib/priorityEngine";

// Начальный ключ сортировки для новой/перепланированной задачи:
// сортирует по score движка приоритета по убыванию, среди равных — по порядку добавления.
let seq = 0;
export function initialOrderKey(t: TaskEvaluation): number {
  seq = (seq + 1) % 1000;
  const { score } = computePriority(t);
  return -score * 1000 + seq;
}
