"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { assignTaskToProject, createProject, renameProject, deleteProject } from "@/app/(app)/actions";
import { buildProjectTree, type ProjectNode } from "@/lib/projectTree";

function ProjectRow({
  id,
  name,
  count,
  active,
  sub,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  onRenamed,
  onDeleted,
}: {
  id: string;
  name: string;
  count: number;
  active: boolean;
  sub?: boolean;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [value, setValue] = useState(name);
  const [, startTransition] = useTransition();

  async function save() {
    const trimmed = value.trim();
    setEditing(false);
    if (!trimmed || trimmed === name) {
      setValue(name);
      return;
    }
    onRenamed(trimmed);
    const fd = new FormData();
    fd.set("name", trimmed);
    startTransition(() => { renameProject(id, fd); });
  }

  function remove() {
    setConfirmingDelete(false);
    onDeleted();
    startTransition(() => { deleteProject(id); });
  }

  if (confirmingDelete) {
    return (
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-red-50 rounded">
        <span className="flex-1 truncate text-red-700">Удалить «{name}»?</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          className="px-1.5 py-0.5 rounded border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-600 shrink-0"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={remove}
          className="px-1.5 py-0.5 rounded bg-red-600 text-white hover:bg-red-700 shrink-0"
        >
          Удалить
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-1.5 py-0.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(name); setEditing(false); }
          }}
          className="w-full border border-neutral-300 rounded px-1.5 py-1 text-sm"
        />
      </div>
    );
  }

  return (
    <div
      className={`group flex items-center gap-2 rounded px-2 py-1.5 text-sm ${
        dragOver ? "bg-neutral-200" : active ? "bg-neutral-800 text-white" : "text-neutral-700 hover:bg-neutral-100"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <Link href={`/projects/${id}`} className="flex-1 min-w-0 flex items-center justify-between">
        <span className="truncate">{sub ? `— ${name}` : name}</span>
        <span className="text-xs opacity-60 ml-1 shrink-0">{count}</span>
      </Link>
      <span className="hidden group-hover:flex items-center gap-1 shrink-0">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className={`text-xs ${active ? "text-white/70 hover:text-white" : "text-neutral-400 hover:text-neutral-700"}`}
          title="Переименовать"
        >
          ✎
        </button>
        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className={`text-xs ${active ? "text-white/70 hover:text-white" : "text-neutral-400 hover:text-red-600"}`}
          title="Удалить"
        >
          ✕
        </button>
      </span>
    </div>
  );
}

export default function Sidebar({
  projects: initialProjects,
  counts,
  noProjectCount,
  totalCount,
}: {
  projects: ProjectNode[];
  counts: Record<string, number>;
  noProjectCount: number;
  totalCount: number;
}) {
  const pathname = usePathname();
  const [projects, setProjects] = useState(initialProjects);
  const [prevInitialProjects, setPrevInitialProjects] = useState(initialProjects);

  if (initialProjects !== prevInitialProjects) {
    setPrevInitialProjects(initialProjects);
    setProjects(initialProjects);
  }
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addingSubTo, setAddingSubTo] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [, startTransition] = useTransition();

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const tree = buildProjectTree(projects);

  function handleDrop(projectId: string | null) {
    return (e: React.DragEvent) => {
      e.preventDefault();
      setDragOverKey(null);
      const taskId = e.dataTransfer.getData("text/plain");
      if (!taskId) return;
      startTransition(() => {
        assignTaskToProject(taskId, projectId);
      });
    };
  }

  async function submitNewProject(parentId: string | null) {
    const value = name.trim();
    if (!value) return;
    const fd = new FormData();
    fd.set("name", value);
    if (parentId) fd.set("parentId", parentId);
    const created = await createProject(fd);
    setName("");
    setAdding(false);
    setAddingSubTo(null);
    if (created) setProjects((prev) => [...prev, created]);
  }

  function renameLocal(id: string, newName: string) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, name: newName } : p)));
  }

  function deleteLocal(id: string) {
    setProjects((prev) => prev.filter((p) => p.id !== id && p.parentId !== id));
  }

  const rowClass = (active: boolean, dragOver: boolean) =>
    `flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm cursor-pointer ${
      dragOver
        ? "bg-neutral-200"
        : active
        ? "bg-neutral-800 text-white"
        : "text-neutral-700 hover:bg-neutral-100"
    }`;

  return (
    <aside className="w-56 shrink-0 border-r border-neutral-200 bg-neutral-50 p-3 space-y-4 overflow-y-auto h-full">
      <nav className="space-y-0.5">
        <Link href="/add" className={rowClass(pathname === "/add", false)}>
          <span>Добавить AI</span>
        </Link>
        <Link href="/today" className={rowClass(pathname === "/today", false)}>
          <span>План дня</span>
        </Link>
        <Link href="/backlog" className={rowClass(pathname === "/backlog", false)}>
          <span>Задачи</span>
          <span className="text-xs opacity-60">{totalCount}</span>
        </Link>
        <Link href="/history" className={rowClass(pathname === "/history", false)}>
          <span>История</span>
        </Link>
      </nav>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOverKey("__none__"); }}
        onDragLeave={() => setDragOverKey((k) => (k === "__none__" ? null : k))}
        onDrop={handleDrop(null)}
      >
        <Link href="/backlog?project=none" className={rowClass(false, dragOverKey === "__none__")}>
          <span>Без проекта</span>
          <span className="text-xs opacity-60">{noProjectCount}</span>
        </Link>
      </div>

      <div>
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide">Проекты</p>
          <button
            type="button"
            onClick={() => { setAdding((v) => !v); setName(""); }}
            className="text-neutral-400 hover:text-neutral-800 text-sm"
            title="Новый проект"
          >
            +
          </button>
        </div>

        {adding && (
          <div className="flex gap-1 px-2 py-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitNewProject(null)}
              placeholder="Название проекта"
              className="flex-1 border border-neutral-300 rounded px-2 py-1 text-xs"
            />
          </div>
        )}

        <div className="space-y-0.5 mt-1">
          {tree.map((top) => {
            const isCollapsed = collapsed.has(top.id);
            return (
              <div key={top.id}>
                <div className="flex items-center gap-1">
                  {top.children.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(top.id)}
                      className="shrink-0 w-3 text-xs opacity-60 hover:opacity-100"
                    >
                      {isCollapsed ? "▸" : "▾"}
                    </button>
                  ) : (
                    <span className="shrink-0 w-3" />
                  )}
                  <div className="flex-1 min-w-0">
                    <ProjectRow
                      id={top.id}
                      name={top.name}
                      count={counts[top.id] ?? 0}
                      active={pathname === `/projects/${top.id}`}
                      dragOver={dragOverKey === top.id}
                      onDragOver={(e) => { e.preventDefault(); setDragOverKey(top.id); }}
                      onDragLeave={() => setDragOverKey((k) => (k === top.id ? null : k))}
                      onDrop={handleDrop(top.id)}
                      onRenamed={(n) => renameLocal(top.id, n)}
                      onDeleted={() => deleteLocal(top.id)}
                    />
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="ml-3">
                    {top.children.map((sub) => (
                      <ProjectRow
                        key={sub.id}
                        id={sub.id}
                        name={sub.name}
                        count={counts[sub.id] ?? 0}
                        active={pathname === `/projects/${sub.id}`}
                        sub
                        dragOver={dragOverKey === sub.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverKey(sub.id); }}
                        onDragLeave={() => setDragOverKey((k) => (k === sub.id ? null : k))}
                        onDrop={handleDrop(sub.id)}
                        onRenamed={(n) => renameLocal(sub.id, n)}
                        onDeleted={() => deleteLocal(sub.id)}
                      />
                    ))}
                    {addingSubTo === top.id ? (
                      <div className="flex gap-1 px-2 py-1">
                        <input
                          autoFocus
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && submitNewProject(top.id)}
                          placeholder="Подпроект"
                          className="flex-1 border border-neutral-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setAddingSubTo(top.id); setName(""); }}
                        className="text-xs text-neutral-400 hover:text-neutral-700 px-2"
                      >
                        + подпроект
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
