"use client";

import { useEffect, useState } from "react";
import { tasksWord } from "@/lib/pluralize";

// Честное зеркало того, что вот-вот сохранится, прямо над кнопкой — не блокирует,
// просто не даёт молча сохранить "все выполнены" не заметив. Слушает чекбоксы
// напрямую через DOM, а не через проброс состояния — каждая задача уже своя
// независимая клиентская строка (EveningTaskRow), поднимать их состояние сюда
// было бы куда большей переделкой ради одной строки текста.
export default function EveningSummaryCounter({ total }: { total: number }) {
  const [done, setDone] = useState<number | null>(null);

  useEffect(() => {
    function recount() {
      const boxes = document.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name^="done_"]');
      setDone(Array.from(boxes).filter((b) => b.checked).length);
    }
    recount();
    document.addEventListener("change", recount);
    return () => document.removeEventListener("change", recount);
  }, []);

  if (done === null || total === 0) return null;
  const notDone = total - done;

  return (
    <p className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-lg px-3 py-2">
      Отметите {done} {tasksWord(done)} выполненными
      {notDone > 0 ? `, ${notDone} — нет` : ""}.
    </p>
  );
}
