// Дата хранится и сравнивается как "календарный день" в полночь UTC.
// Год/месяц/число берутся не из локального времени СЕРВЕРА (на Vercel это UTC,
// а не Москва — "сегодня" сдвигалось бы на 3 часа около полуночи), а из времени
// в APP_TIMEZONE — так "сегодня" одинаково и локально, и в проде, независимо от
// того, в каком часовом поясе физически выполняется код.
export const APP_TIMEZONE = process.env.APP_TIMEZONE || "Europe/Moscow";

function ymdInTimeZone(d: Date, timeZone: string): { y: number; m: number; day: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { y: get("year"), m: get("month"), day: get("day") };
}

export function dateOnly(d: Date): Date {
  const { y, m, day } = ymdInTimeZone(d, APP_TIMEZONE);
  return new Date(Date.UTC(y, m - 1, day));
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + n);
  return copy;
}

export function todayDate(): Date {
  return dateOnly(new Date());
}

export function tomorrowDate(): Date {
  return addDays(todayDate(), 1);
}

// Ближайший будний день — сама дата, если это уже Пн–Пт, иначе следующий
// понедельник. Используется только там, где день подставляется автоматически
// (не было явного выбора пользователя) — суббота/воскресенье не должны
// получать задачи молча, только если день назвали прямо.
export function nextWeekday(d: Date): Date {
  const day = d.getUTCDay(); // 0 = вс, 6 = сб
  if (day === 6) return addDays(d, 2);
  if (day === 0) return addDays(d, 1);
  return d;
}

export function sameDate(a: Date, b: Date): boolean {
  return a.getTime() === b.getTime();
}

export function formatDateHuman(d: Date): string {
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

// С днём недели — для заголовка экрана дня, где это первое, что видно на странице.
export function formatDateHumanFull(d: Date): string {
  const weekday = d.toLocaleDateString("ru-RU", { weekday: "long", timeZone: "UTC" });
  return `${formatDateHuman(d)}, ${weekday}`;
}

// Человекочитаемая дата для мест, где важна не столько точная дата, сколько
// "далеко/близко" — Сегодня/Завтра/Вчера, иначе короткое "26 августа" (год —
// только если не текущий). Сырой ISO (2026-08-25) не должен быть тем, что видит
// пользователь как основной текст где бы то ни было в интерфейсе.
export function formatDateRelative(d: Date, today: Date = todayDate()): string {
  // Строчными — все места использования вставляют это в середину фразы
  // ("· на сегодня", "В план на завтра"), а не в начало предложения.
  if (sameDate(d, today)) return "сегодня";
  if (sameDate(d, addDays(today, 1))) return "завтра";
  if (sameDate(d, addDays(today, -1))) return "вчера";
  return d.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: d.getUTCFullYear() === today.getUTCFullYear() ? undefined : "numeric",
    timeZone: "UTC",
  });
}

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateInputValue(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
