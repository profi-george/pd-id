// Палитра для ярлыка проекта — фиксированный набор, чтобы цвета были
// достаточно насыщенными для белого текста поверх (пилюли/бейджи) и при
// этом различимыми между собой в маленьких точках-маркерах в сайдбаре.
export const PROJECT_COLORS: { value: string; name: string }[] = [
  { value: "#EF4444", name: "Красный" },
  { value: "#F97316", name: "Оранжевый" },
  { value: "#D97706", name: "Янтарный" },
  { value: "#65A30D", name: "Лаймовый" },
  { value: "#10B981", name: "Зелёный" },
  { value: "#0D9488", name: "Бирюзовый" },
  { value: "#3B82F6", name: "Синий" },
  { value: "#423ADF", name: "Индиго" },
  { value: "#A855F7", name: "Фиолетовый" },
  { value: "#EC4899", name: "Розовый" },
];

export function isProjectColor(value: string | null | undefined): value is string {
  return !!value && PROJECT_COLORS.some((c) => c.value === value);
}
