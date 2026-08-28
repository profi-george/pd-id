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

// Короткие заметки по фазам — по общим данным исследований цикла (не диагноз,
// не персональная аналитика: собственные конфликты/настроение из "Итога дня"
// сюда сознательно не подмешиваются, только общая физиология).
// Источники: Cleveland Clinic (лютеиновая/фолликулярная фаза, симптомы по фазам),
// NCBI StatPearls (ПМС, до ~75% женщин с регулярным циклом отмечают симптомы
// в лютеиновой фазе).
const PHASE_NOTE: Record<CyclePhase, string> = {
  menstruation: "Эстроген и прогестерон на минимуме — обычно упадок сил и возможны спазмы в первые дни.",
  follicular: "Эстроген растёт — обычно прибавляется энергии и концентрации.",
  ovulation: "Пик эстрогена и всплеск ЛГ. Возможна лёгкая тянущая боль внизу живота с одной стороны, у части женщин — прилив энергии.",
  luteal: "Растёт прогестерон — у части женщин уже появляется чувствительность к переменам настроения и утомляемость.",
  pms: "Резкий спад гормонов перед месячными — до 75% женщин с регулярным циклом отмечают раздражительность, тревожность, перепады настроения и вздутие.",
};

export function getCycleNote(
  info: CycleInfo,
  cycleLengthDays: number = DEFAULT_CYCLE_LENGTH
): string {
  const base = PHASE_NOTE[info.phase];
  const daysToEnd = cycleLengthDays - info.day;
  if (daysToEnd <= 1 && daysToEnd >= 0) {
    return `${base} Через 1–2 дня могут начаться месячные.`;
  }
  return base;
}
