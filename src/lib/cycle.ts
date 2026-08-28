// Календарь женского цикла — упрощённая версия логики FLO: по дате начала
// последней менструации и средней длине цикла считаем текущий день цикла и фазу.
// Это оценка, не диагностика — овуляция/ПМС предсказываются по стандартным
// средним (лютеиновая фаза ~14 дней, ПМС — последние 5 дней цикла), а не по
// индивидуальным симптомам. Если реальный цикл отличается, дату начала можно
// просто обновить в настройках.

export type CyclePhase = "menstruation" | "follicular" | "ovulation" | "luteal" | "pms";

export const DEFAULT_CYCLE_LENGTH = 28;
export const DEFAULT_PERIOD_LENGTH = 5;

const PMS_WINDOW_DAYS = 5;
const LUTEAL_PHASE_DAYS = 14; // более стабильная величина, чем фолликулярная фаза — от неё считаем овуляцию назад от конца цикла

export const PHASE_LABEL: Record<CyclePhase, string> = {
  menstruation: "Менструация",
  follicular: "Фолликулярная фаза",
  ovulation: "Овуляция",
  luteal: "Лютеиновая фаза",
  pms: "Ожидается ПМС",
};

export type CycleInfo = { day: number; phase: CyclePhase; phaseLabel: string };

// Разница в календарных днях между двумя UTC-полуночными датами (см. src/lib/dates.ts).
function daysBetween(from: Date, to: Date): number {
  const msPerDay = 86400000;
  return Math.round((to.getTime() - from.getTime()) / msPerDay);
}

export function computeCycleDay(
  startDate: Date,
  targetDate: Date,
  cycleLengthDays: number = DEFAULT_CYCLE_LENGTH
): number {
  const diff = daysBetween(startDate, targetDate);
  const mod = ((diff % cycleLengthDays) + cycleLengthDays) % cycleLengthDays;
  return mod + 1;
}

export function computeCyclePhase(
  day: number,
  cycleLengthDays: number = DEFAULT_CYCLE_LENGTH,
  periodLengthDays: number = DEFAULT_PERIOD_LENGTH
): CyclePhase {
  const ovulationDay = Math.max(1, cycleLengthDays - LUTEAL_PHASE_DAYS);
  const pmsStart = cycleLengthDays - PMS_WINDOW_DAYS + 1;
  if (day <= periodLengthDays) return "menstruation";
  if (day >= pmsStart) return "pms";
  if (Math.abs(day - ovulationDay) <= 1) return "ovulation";
  if (day < ovulationDay) return "follicular";
  return "luteal";
}

export function getCycleInfo(
  startDate: Date,
  targetDate: Date,
  cycleLengthDays: number = DEFAULT_CYCLE_LENGTH,
  periodLengthDays: number = DEFAULT_PERIOD_LENGTH
): CycleInfo {
  const day = computeCycleDay(startDate, targetDate, cycleLengthDays);
  const phase = computeCyclePhase(day, cycleLengthDays, periodLengthDays);
  return { day, phase, phaseLabel: PHASE_LABEL[phase] };
}
