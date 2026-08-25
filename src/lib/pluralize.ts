// Русское склонение по числу: 1 задача, 2 задачи, 5 задач.
export function pluralize(n: number, [one, few, many]: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export function tasksWord(n: number): string {
  return pluralize(n, ["задача", "задачи", "задач"]);
}
