"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { undoMoveTask } from "@/app/(app)/actions";

// Отмена переноса прямо в Итоге дня — там человек и видит "убрано из плана" факт
// и может тут же передумать, если copy на новом месте ещё не тронута.
export default function UndoMoveButton({ taskId }: { taskId: string }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");

  async function handleClick() {
    setState("pending");
    const res = await undoMoveTask(taskId);
    if (res.ok) {
      router.refresh();
    } else {
      setState("error");
    }
  }

  if (state === "error") {
    return <span className="text-amber-600">— уже нельзя отменить: копия задачи изменена</span>;
  }

  return (
    <button
      type="button"
      disabled={state === "pending"}
      onClick={handleClick}
      className="underline text-neutral-500 hover:text-neutral-700 disabled:opacity-50"
    >
      {state === "pending" ? "отменяю…" : "отменить"}
    </button>
  );
}
