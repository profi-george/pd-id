// Разбор "списка из головы" по простым "когда" вместо пяти уровней приоритета:
// Сегодня / Завтра / На неделе / Потом (плюс любая конкретная дата). ИИ предлагает корзину для каждой задачи, глядя
// на весь список сразу, а лимит "Сегодня" соблюдает уже этот код — чтобы день
// не переполнялся, даже если ИИ решил, что срочно всё.

import { computePriority } from "@/lib/priorityEngine";
import type { AiTaskEvaluation } from "@/lib/ai";

export type Bucket = "today" | "tomorrow" | "week" | "later";

export const BUCKET_ORDER: Bucket[] = ["today", "tomorrow", "week", "later"];

export const BUCKET_TEXT: Record<Bucket, string> = {
  today: "Сегодня",
  tomorrow: "Завтра",
  week: "На неделе",
  later: "Потом",
};

export const TODAY_MAX_TASKS = 3;
export const TODAY_MAX_MINUTES = 5 * 60;

export function isBucket(v: unknown): v is Bucket {
  return v === "today" || v === "tomorrow" || v === "week" || v === "later";
}

function score(t: AiTaskEvaluation) {
  const deadline = t.deadline ? new Date(`${t.deadline}T00:00:00.000Z`) : null;
  return computePriority({ ...t, urgency: t.timeSensitivity, deadline });
}

// Если ИИ корзину не вернул — берём её из обычного расчёта приоритета.
function fallbackBucket(t: AiTaskEvaluation): Bucket {
  const label = score(t).label;
  if (label === "P0") return "today";
  if (label === "P1" || label === "P2") return "week";
  return "later";
}

// Корзина по явно названному дню: дата всегда главнее оценки ИИ — пользователь
// сам сказал, когда делать. Сегодня/завтра — свои корзины, ближайшая неделя →
// "На неделе", дальше → "Потом" (в план на этот день задача встанет всё равно).
export function bucketForDate(dateISO: string, todayISO: string): Bucket {
  if (dateISO <= todayISO) return "today";
  const days = (Date.parse(dateISO) - Date.parse(todayISO)) / 86_400_000;
  if (days <= 1) return "tomorrow";
  return days <= 7 ? "week" : "later";
}

export function assignBuckets(tasks: AiTaskEvaluation[], todayISO: string): AiTaskEvaluation[] {
  const withBucket = tasks.map((t) => {
    const bucket: Bucket = t.scheduledDate
      ? bucketForDate(t.scheduledDate, todayISO)
      : isBucket(t.bucket)
        ? t.bucket
        : fallbackBucket(t);
    return { ...t, bucket, bumpedFromToday: false };
  });

  // Лимит "Сегодня": оставляем самые приоритетные по расчёту, пока влезают по
  // числу и по времени. Первая задача остаётся всегда, даже если она одна
  // больше лимита по времени, — иначе "Сегодня" оказалось бы пустым. Задачи,
  // которые пользователь сам поставил на сегодня, не выталкиваются никогда.
  const today = withBucket
    .filter((t) => t.bucket === "today" && !t.scheduledDate)
    .sort((a, b) => score(b).score - score(a).score);
  const pinned = withBucket.filter((t) => t.bucket === "today" && t.scheduledDate);
  const keep = new Set<AiTaskEvaluation>();
  let count = pinned.length;
  let minutes = pinned.reduce((s, t) => s + t.effortMinutes, 0);
  for (const t of today) {
    const fits = count < TODAY_MAX_TASKS && (count === 0 || minutes + t.effortMinutes <= TODAY_MAX_MINUTES);
    if (!fits) continue;
    keep.add(t);
    count++;
    minutes += t.effortMinutes;
  }

  return withBucket.map((t) =>
    t.bucket === "today" && !t.scheduledDate && !keep.has(t) ? { ...t, bucket: "week", bumpedFromToday: true } : t
  );
}

export function addDaysISO(dateISO: string, n: number): string {
  const d = new Date(`${dateISO}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
