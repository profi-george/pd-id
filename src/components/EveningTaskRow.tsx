"use client";

import { useState } from "react";
import PriorityTag from "@/components/PriorityTag";
import type { TaskEvaluation } from "@/lib/priorityEngine";

const SCALE_10 = Array.from({ length: 11 }, (_, i) => i);

export type EveningTask = TaskEvaluation & {
  id: string;
  text: string;
  projectName: string | null;
};

export default function EveningTaskRow({ task }: { task: EveningTask }) {
  const [done, setDone] = useState(true);

  return (
    <div className="bg-white border border-neutral-200 rounded-lg px-3 py-2 space-y-2">
      <p className="text-sm">{task.text}</p>
      <div className="flex items-center gap-2 text-xs text-neutral-500">
        {task.projectName ? <span>{task.projectName}</span> : null}
        <PriorityTag task={task} />
      </div>
      <div className="flex items-center gap-4">
        <label className="flex items-center gap-1.5 text-sm">
          <input
            type="checkbox"
            name={`done_${task.id}`}
            checked={done}
            onChange={(e) => setDone(e.target.checked)}
          />
          Выполнена
        </label>
        <label className="flex items-center gap-1.5 text-sm">
          Результат
          <select
            name={`score_${task.id}`}
            defaultValue=""
            className="border border-neutral-300 rounded px-1 py-0.5 text-sm"
          >
            <option value="">—</option>
            {SCALE_10.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          /10
        </label>
      </div>
      {done ? (
        <label className="block text-xs">
          <span className="text-neutral-500">Почему получилось? (необязательно)</span>
          <textarea
            name={`whySucceeded_${task.id}`}
            rows={2}
            className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </label>
      ) : (
        <label className="block text-xs">
          <span className="text-neutral-500">Почему не получилось?</span>
          <textarea
            name={`whyFailed_${task.id}`}
            rows={2}
            className="mt-0.5 w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </label>
      )}
    </div>
  );
}
