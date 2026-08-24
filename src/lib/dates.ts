// Дата хранится и сравнивается как "календарный день" в полночь UTC,
// но год/месяц/число берутся из локального времени сервера —
// так один и тот же день не "прыгает" при сравнении.

export function dateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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

export function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function parseDateInputValue(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}
