import Link from "next/link";

// Список/Матрица — обычная ссылка (как и другие переключатели вида в
// приложении), а не клиентское состояние: переключатель живёт в верхнем
// правом углу рядом с остальными переключателями, одинаково на каждом
// экране со списком задач.
export default function LayoutToggle({
  layout,
  hrefFor,
}: {
  layout: "list" | "grid";
  hrefFor: (l: "list" | "grid") => string;
}) {
  return (
    <div className="flex items-center border border-neutral-300 rounded-lg overflow-hidden text-xs shrink-0">
      <Link href={hrefFor("list")} className={`px-2.5 py-1 ${layout === "list" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
        Список
      </Link>
      <Link href={hrefFor("grid")} className={`px-2.5 py-1 border-l border-neutral-300 ${layout === "grid" ? "bg-neutral-800 text-white" : "text-neutral-500 hover:bg-neutral-50"}`}>
        Матрица
      </Link>
    </div>
  );
}
