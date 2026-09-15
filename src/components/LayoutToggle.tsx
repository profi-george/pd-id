import Link from "next/link";
import { IconGrid, IconRows } from "@/components/icons";

// Список/Матрица — обычная ссылка (как и другие переключатели вида в
// приложении), а не клиентское состояние: переключатель живёт в верхнем
// правом углу рядом с остальными переключателями, одинаково на каждом
// экране со списком задач.
//
// Иконка + подпись, а не одна подпись: рядом стоит второй такой же
// переключатель (План дня/Все задачи), и два одинаковых по форме контрола
// подряд глаз не различал — приходилось читать текст, чтобы понять, какой
// из них какой.
export default function LayoutToggle({
  layout,
  hrefFor,
}: {
  layout: "list" | "grid";
  hrefFor: (l: "list" | "grid") => string;
}) {
  return (
    <div className="segmented shrink-0">
      <Link href={hrefFor("list")} className="segment" data-active={layout === "list"}>
        <IconRows size={13} className="shrink-0" />
        Список
      </Link>
      <Link href={hrefFor("grid")} className="segment" data-active={layout === "grid"}>
        <IconGrid size={13} className="shrink-0" />
        Матрица
      </Link>
    </div>
  );
}
