"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import PriorityTag from "@/components/PriorityTag";
import type { TaskEvaluation } from "@/lib/priorityEngine";

export type ReorderableTask = TaskEvaluation & {
  id: string;
  text: string;
  projectName: string | null;
};

export default function TaskReorderList({
  tasks,
  reorderAction,
  deleteAction,
  emptyText,
}: {
  tasks: ReorderableTask[];
  reorderAction: (orderedIds: string[]) => Promise<void>;
  deleteAction: (id: string) => Promise<void>;
  emptyText: string;
}) {
  const [items, setItems] = useState(tasks);
  const [prevTasks, setPrevTasks] = useState(tasks);
  const dragIndex = useRef<number | null>(null);
  const [, startTransition] = useTransition();

  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems(tasks);
  }

  function handleDrop(targetIndex: number) {
    const from = dragIndex.current;
    dragIndex.current = null;
    if (from === null || from === targetIndex) return;

    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
    startTransition(() => {
      reorderAction(next.map((t) => t.id));
    });
  }

  function handleDelete(id: string) {
    setItems((prev) => prev.filter((t) => t.id !== id));
    startTransition(() => {
      deleteAction(id);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-neutral-400">{emptyText}</p>;
  }

  return (
    <ul className="space-y-2">
      {items.map((t, idx) => (
        <li
          key={t.id}
          draggable
          onDragStart={() => (dragIndex.current = idx)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => handleDrop(idx)}
          className="bg-white border border-neutral-200 rounded-lg px-3 py-2 flex items-center gap-3 cursor-grab active:cursor-grabbing"
        >
          <span className="text-neutral-300 select-none">⠿</span>
          <div className="flex-1 space-y-1">
            <p className="text-sm">{t.text}</p>
            <div className="flex items-center gap-2 text-xs text-neutral-500">
              {t.projectName ? <span>{t.projectName}</span> : null}
              <PriorityTag task={t} />
            </div>
          </div>
          <Link
            href={`/tasks/${t.id}/edit?returnTo=/today`}
            className="text-xs px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
          >
            Изменить
          </Link>
          <button
            onClick={() => handleDelete(t.id)}
            className="text-xs px-2 py-1 rounded text-red-600 hover:bg-red-50"
          >
            Удалить
          </button>
        </li>
      ))}
    </ul>
  );
}
