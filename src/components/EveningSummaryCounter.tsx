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

  return (
    <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
      Выполнено {counts.done} {tasksWord(counts.done)}
      {counts.partial > 0 ? `, частично — ${counts.partial}` : ""}
      {counts.notDone > 0 ? `, не выполнено — ${counts.notDone}` : ""}.
    </p>
  );
}
