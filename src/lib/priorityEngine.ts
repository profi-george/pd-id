// Детерминированный расчёт приоритета. ИИ только оценивает критерии (см. lib/ai.ts),
// сам score и сортировку всегда считает этот код — так порядок задач воспроизводим
// и не зависит от того, что "решит" модель при повторном запросе.

// Единый порог "AI не уверен" — используется и в бейдже карточки списка, и в панели
// задачи. Совпадает с порогом, который задаёт confidenceReason в промпте (lib/ai.ts),
// чтобы бейдж в списке и подсказка в карточке всегда срабатывали на одних и тех же задачах.
export const LOW_CONFIDENCE_THRESHOLD = 0.75;

export type TaskEvaluation = {
  value: number; // ценность результата, 1-5
  costOfDelay: number; // цена откладывания, 1-5
  urgency: number; // срочность, 1-5 (для отображения; в базовую формулу не входит напрямую)
  timeSensitivity: number; // временная чувствительность, 1-5
  goalAlignment: number; // связь с текущей целью, 1-5
  effortMinutes: number; // затраты в минутах
  alternativeQuality: number; // 0..1, есть ли равноценная альтернатива
  confidence: number; // 0..1, уверенность оценки
  deadline: Date | null;
  financialConsequence: boolean;
  manualPriority?: string | null; // P0 | P1 | P2 | P3 | LATER — ручной override
  primaryReason?: string | null; // объяснение (только для отображения)
  riskText?: string | null; // риск отложить (только для отображения)
  note?: string | null; // заметка пользователя о подходе к выполнению (только для отображения)
  projectPriority?: string | null; // P0 | P1 | P2 | P3 | LATER — приоритет проекта, к которому привязана задача
};

export type PriorityLabel = "P0" | "P1" | "P2" | "P3" | "LATER";

export type PriorityResult = {
  score: number;
  scorePercent: number; // 0..100, для показа пользователю
  label: PriorityLabel;
  aiLabel: PriorityLabel; // что посчитал бы AI без ручного override
  isManual: boolean;
  hardRuleApplied: boolean;
};

const LABEL_ORDER: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];

export function isPriorityLabel(v: unknown): v is PriorityLabel {
  return typeof v === "string" && (LABEL_ORDER as string[]).includes(v);
}

// Приоритет проекта — небольшой модификатор в том же узком диапазоне, что и
// остальные (goalMod/timeMod/altMod), а не отдельная система: проект с высоким
// приоритетом слегка подтягивает свои задачи вверх, но не переворачивает порядок
// внутри проекта самостоятельно, и не задаётся — задача без проекта или проект
// без выставленного приоритета получают нейтральный множитель.
const PROJECT_PRIORITY_MOD: Record<PriorityLabel, number> = {
  P0: 1.15,
  P1: 1.05,
  P2: 1.0,
  P3: 0.92,
  LATER: 0.85,
};

// Effort Factor: чем больше времени требует задача, тем сильнее это давит на приоритет вниз.
// Шкала — проектная v1, см. ТЗ; при накоплении данных можно откалибровать.
function effortFactor(minutes: number): number {
  if (minutes <= 15) return 1.0;
  if (minutes <= 60) return 1.3;
  if (minutes <= 180) return 1.7;
  if (minutes <= 480) return 2.2;
  if (minutes <= 1440 * 3) return 3.0;
  return 4.0;
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function isDeadlineCritical(deadline: Date | null, now: Date): boolean {
  if (!deadline) return false;
  const hoursLeft = (deadline.getTime() - now.getTime()) / 3_600_000;
  return hoursLeft <= 24; // сегодня/просрочено/менее суток
}

function scoreToLabel(score: number): PriorityLabel {
  if (score >= 18) return "P0";
  if (score >= 10) return "P1";
  if (score >= 5) return "P2";
  if (score >= 2) return "P3";
  return "LATER";
}

export function computePriority(evalu: TaskEvaluation, now: Date = new Date()): PriorityResult {
  const value = clamp(evalu.value, 1, 5);
  const costOfDelay = clamp(evalu.costOfDelay, 1, 5);
  const goalAlignment = clamp(evalu.goalAlignment, 1, 5);
  const timeSensitivity = clamp(evalu.timeSensitivity, 1, 5);
  const alternativeQuality = clamp(evalu.alternativeQuality, 0, 1);

  const base = (value * costOfDelay) / effortFactor(evalu.effortMinutes);

  // Модификаторы контекста — намеренно в узком диапазоне, чтобы не переворачивать порядок целиком.
  const goalMod = 0.9 + ((goalAlignment - 1) / 4) * 0.2; // 0.9..1.1
  const timeMod = 0.9 + ((timeSensitivity - 1) / 4) * 0.3; // 0.9..1.2
  const altMod = 1.0 - alternativeQuality * 0.1; // 0.9..1.0

  let score = base * goalMod * timeMod * altMod;
  if (evalu.financialConsequence) score *= 1.1;
  if (evalu.projectPriority && isPriorityLabel(evalu.projectPriority)) {
    score *= PROJECT_PRIORITY_MOD[evalu.projectPriority];
  }

  const hardRuleApplied = isDeadlineCritical(evalu.deadline, now);

  let aiLabel: PriorityLabel;
  if (hardRuleApplied) {
    aiLabel = "P0"; // критический дедлайн выводит задачу в P0 независимо от score
  } else if (costOfDelay <= 2 && evalu.urgency <= 2 && value <= 2) {
    aiLabel = "LATER"; // явно малоценные и несрочные — сразу "Позже"
  } else {
    aiLabel = scoreToLabel(score);
  }

  const scorePercent = Math.round(clamp(score * 5, 1, 100));

  const manual = evalu.manualPriority;
  if (manual && isPriorityLabel(manual)) {
    return { score, scorePercent, label: manual, aiLabel, isManual: true, hardRuleApplied };
  }

  return { score, scorePercent, label: aiLabel, aiLabel, isManual: false, hardRuleApplied };
}

// Пользователь никогда не должен видеть "P0"/"P1" — только человеческие названия.
// Технические коды остаются во внутренней логике (сортировка, хранение, движок).
export const PRIORITY_LABEL_TEXT: Record<PriorityLabel, string> = {
  P0: "Фокус",
  P1: "Высокий",
  P2: "Средний",
  P3: "Низкий",
  LATER: "Не сейчас",
};

export const PRIORITY_LABEL_HINT: Record<PriorityLabel, string> = {
  P0: "AI рекомендует сосредоточиться на этом в первую очередь",
  P1: "Важно сделать вскоре после задач «Фокус»",
  P2: "Важная задача, но можно после более приоритетных",
  P3: "Перенос на несколько дней не создаст последствий",
  LATER: "Задача есть, но пока не должна конкурировать за время",
};

export function formatEffort(minutes: number): string {
  if (minutes < 60) return `${minutes} мин`;
  const hours = minutes / 60;
  if (hours < 24) return Number.isInteger(hours) ? `${hours} ч` : `${hours.toFixed(1)} ч`;
  const days = Math.round(hours / 24);
  return `${days} дн`;
}
