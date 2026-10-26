// Разбор "списка из головы" по трём корзинам вместо пяти уровней приоритета:
// Сегодня / На неделе / Потом. ИИ предлагает корзину для каждой задачи, глядя
// на весь список сразу, а лимит "Сегодня" соблюдает уже этот код — чтобы день
// не переполнялся, даже если ИИ решил, что срочно всё.

import { computePriority } from "@/lib/priorityEngine";
import type { AiTaskEvaluation } from "@/lib/ai";

export type Bucket = "today" | "week" | "later";

export const BUCKET_ORDER: Bucket[] = ["today", "week", "later"];

export const BUCKET_TEXT: Record<Bucket, string> = {
  today: "Сегодня",
  week: "На неделе",
  later: "Потом",
};

export const BUCKET_HINT: Record<Bucket, string> = {
  today: "Самое важное на сегодня — не больше 3 задач",
  week: "Важно, но можно не сегодня",
  later: "Не горит — вернётесь, когда освободится время",
};

export const TODAY_MAX_TASKS = 3;
export const TODAY_MAX_MINUTES = 5 * 60;

export function isBucket(v: unknown): v is Bucket {
  return v === "today" || v === "week" || v === "later";
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

// Задача, явно поставленная пользователем на другой день ("в пятницу"), в
// "Сегодня" не попадает, как бы ИИ её ни оценил.
function isScheduledLater(t: AiTaskEvaluation, todayISO: string) {
  return Boolean(t.scheduledDate && t.scheduledDate > todayISO);
}

export function assignBuckets(tasks: AiTaskEvaluation[], todayISO: string): AiTaskEvaluation[] {
  const withBucket = tasks.map((t) => {
    let bucket: Bucket = isBucket(t.bucket) ? t.bucket : fallbackBucket(t);
    if (bucket === "today" && isScheduledLater(t, todayISO)) bucket = "week";
    return { ...t, bucket, bumpedFromToday: false };
  });

  // Лимит "Сегодня": оставляем самые приоритетные по расчёту, пока влезают по
  // числу и по времени. Первая задача остаётся всегда, даже если она одна
  // больше лимита по времени, — иначе "Сегодня" оказалось бы пустым.
  const today = withBucket
    .filter((t) => t.bucket === "today")
    .sort((a, b) => score(b).score - score(a).score);
  const keep = new Set<AiTaskEvaluation>();
  let minutes = 0;
  for (const t of today) {
    const fits = keep.size < TODAY_MAX_TASKS && (keep.size === 0 || minutes + t.effortMinutes <= TODAY_MAX_MINUTES);
    if (!fits) continue;
    keep.add(t);
    minutes += t.effortMinutes;
  }

  return withBucket.map((t) =>
    t.bucket === "today" && !keep.has(t) ? { ...t, bucket: "week", bumpedFromToday: true } : t
  );
}
