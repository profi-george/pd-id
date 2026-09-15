"use client";

import { useEffect, useState } from "react";
import { tasksWord } from "@/lib/pluralize";

// Честное зеркало того, что вот-вот сохранится, прямо над кнопкой. Слушает
// радиокнопки исхода напрямую через DOM, а не через проброс состояния — каждая
// задача уже своя независимая клиентская строка (EveningTaskRow), поднимать
// их состояние сюда было бы куда большей переделкой ради одной строки текста.
export default function EveningSummaryCounter({ total }: { total: number }) {
  const [counts, setCounts] = useState<{ done: number; partial: number; notDone: number } | null>(null);

  useEffect(() => {
    function recount() {
      const checked = document.querySelectorAll<HTMLInputElement>('input[type="radio"][name^="outcome_"]:checked');
      let done = 0, partial = 0, notDone = 0;
      checked.forEach((b) => {
        if (b.value === "done") done++;
        else if (b.value === "partial") partial++;
        else notDone++;
      });
      setCounts({ done, partial, notDone });
    }
    recount();
    document.addEventListener("change", recount);
    return () => document.removeEventListener("change", recount);
  }, []);

  if (!counts || total === 0) return null;

  // Три числа-«счётчика» вместо строки текста: перед необратимым сохранением
  // взгляд должен цепляться за цифры, а не вычитывать фразу.
  const cells: { label: string; value: number; tone: string }[] = [
    { label: "Выполнено", value: counts.done, tone: "text-emerald-600" },
    { label: "Частично", value: counts.partial, tone: "text-blue-600" },
    { label: "Не выполнено", value: counts.notDone, tone: "text-neutral-700" },
  ];

  return (
    <div className="surface flex items-stretch divide-x divide-neutral-100 overflow-hidden">
      {cells.map((c) => (
        <div key={c.label} className="flex-1 px-3 py-2.5 text-center">
          <p className={`text-xl font-semibold tabular-nums leading-none ${c.value > 0 ? c.tone : "text-neutral-300"}`}>
            {c.value}
          </p>
          <p className="text-[10px] uppercase tracking-[0.06em] text-neutral-500 mt-1.5">{c.label}</p>
        </div>
      ))}
      <span className="sr-only">
        Выполнено {counts.done} {tasksWord(counts.done)}
        {counts.partial > 0 ? `, частично — ${counts.partial}` : ""}
        {counts.notDone > 0 ? `, не выполнено — ${counts.notDone}` : ""}.
      </span>
    </div>
  );
}
