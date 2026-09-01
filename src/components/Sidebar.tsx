"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { assignTaskToProject, createProject, renameProject, deleteProject, setProjectPriority } from "@/app/(app)/actions";
import { buildProjectTree, type ProjectNode } from "@/lib/projectTree";
import { PRIORITY_LABEL_TEXT, type PriorityLabel } from "@/lib/priorityEngine";

const PROJECT_PRIORITY_OPTIONS: PriorityLabel[] = ["P0", "P1", "P2", "P3"];
const PROJECT_DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

// Приоритет проекта — небольшой модификатор общего расчёта (см. priorityEngine),
// задаётся тут же в сайдбаре, без отдельного экрана настроек проекта.
function ProjectPriorityDot({
  priority,
  onPick,
  dim,
}: {
  priority: string | null;
  onPick: (p: PriorityLabel | null) => void;
  dim?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const valid: PriorityLabel | null = priority && PROJECT_PRIORITY_OPTIONS.includes(priority as PriorityLabel) ? (priority as PriorityLabel) : null;

  return (
    <span ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-3.5 h-3.5 rounded-full flex items-center justify-center"
        title={valid ? `Приоритет проекта: ${PRIORITY_LABEL_TEXT[valid]}` : "Приоритет проекта не задан"}
        aria-label="Приоритет проекта"
      >
        {/* Без приоритета — бледная точка-статус, а не пустое кольцо: не должна
            читаться как незаполненный чекбокс/радио. */}
        <span className={`w-2 h-2 rounded-full ${valid ? PROJECT_DOT_CLASS[valid] : dim ? "bg-white/30" : "bg-neutral-300"}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-5 z-30 w-40 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-xs text-neutral-700">
          <button
            type="button"
            onClick={() => { setOpen(false); onPick(null); }}
            className={`w-full text-left px-3 py-1.5 hover:bg-neutral-50 ${!valid ? "font-medium text-neutral-900" : ""}`}
          >
            Не задан
          </button>
          {PROJECT_PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { setOpen(false); onPick(l); }}
              className={`w-full flex items-center gap-2 text-left px-3 py-1.5 hover:bg-neutral-50 ${valid === l ? "font-medium text-neutral-900" : ""}`}
            >
              <span className={`w-2 h-2 rounded-full ${PROJECT_DOT_CLASS[l]}`} />
              {PRIORITY_LABEL_TEXT[l]}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Переименовать/удалить — раньше были двумя отдельными значками, вместо
// одного меню "⋯" (тот же язык, что и у меню строки задачи).
function ProjectMenu({
  dim,
  onRename,
  onDelete,
}: {
  dim?: boolean;
  onRename: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <span ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-5 h-5 flex items-center justify-center rounded text-xs ${
          dim ? "text-white/70 hover:text-white hover:bg-white/10" : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200"
        }`}
        aria-label="Действия с проектом"
      >
        ⋯
      </button>
      {open && (
        <div className="absolute right-0 top-6 z-30 w-36 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-xs">
          <button
            type="button"
            onClick={() => { setOpen(false); onRename(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-neutral-700"
          >
            Переименовать
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); onDelete(); }}
            className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-red-600"
          >
            Удалить
          </button>
        </div>
      )}
    </span>
  );
}

function ProjectRow({
  id,
  name,
  count,
  active,
  priority,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  onRenamed,
  onDeleted,
  onPriorityChanged,
  onAddChild,
}: {
  id: string;
  name: string;
  count: number;
  active: boolean;
  priority: string | null;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
  onPriorityChanged: (p: string | null) => void;
  // Только у проектов верхнего уровня — вложенность у нас всего в один уровень.
  onAddChild?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [value, setValue] = useState(name);
  const [, startTransition] = useTransition();

  function handlePriorityPick(p: PriorityLabel | null) {
    onPriorityChanged(p);
    startTransition(() => { setProjectPriority(id, p); });
  }

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
      <ProjectPriorityDot priority={priority} onPick={handlePriorityPick} dim={active} />
      <Link href={`/projects/${id}`} className="flex-1 min-w-0 flex items-center justify-between">
        <span className="truncate">{name}</span>
        <span
          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full tabular-nums ml-1 shrink-0 ${
            active ? "bg-white/20 text-white" : "bg-ink-100 text-ink-700"
          }`}
        >
          {count}
        </span>
      </Link>
      <span className="hidden group-hover:flex items-center gap-0.5 shrink-0">
        {onAddChild && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className={`w-5 h-5 flex items-center justify-center rounded text-sm leading-none ${
              active ? "text-white/70 hover:text-white hover:bg-white/10" : "text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200"
            }`}
            title="Новый проект"
            aria-label="Добавить проект внутри"
          >
            +
          </button>
        )}
        <ProjectMenu dim={active} onRename={() => setEditing(true)} onDelete={() => setConfirmingDelete(true)} />
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

  function priorityLocal(id: string, priority: string | null) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, priority } : p)));
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
        <Link href="/today?view=all&project=none" className={rowClass(false, dragOverKey === "__none__")}>
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
                      priority={top.priority ?? null}
                      dragOver={dragOverKey === top.id}
                      onDragOver={(e) => { e.preventDefault(); setDragOverKey(top.id); }}
                      onDragLeave={() => setDragOverKey((k) => (k === top.id ? null : k))}
                      onDrop={handleDrop(top.id)}
                      onRenamed={(n) => renameLocal(top.id, n)}
                      onDeleted={() => deleteLocal(top.id)}
                      onPriorityChanged={(p) => priorityLocal(top.id, p)}
                      onAddChild={() => { setAddingSubTo(top.id); setName(""); }}
                    />
                  </div>
                </div>
                {!isCollapsed && (top.children.length > 0 || addingSubTo === top.id) && (
                  // Тонкая линия слева — вложенность видна сама, без подписи "подпроект".
                  <div className="ml-3 pl-2 border-l border-neutral-200">
                    {top.children.map((sub) => (
                      <ProjectRow
                        key={sub.id}
                        id={sub.id}
                        name={sub.name}
                        count={counts[sub.id] ?? 0}
                        active={pathname === `/projects/${sub.id}`}
                        priority={sub.priority ?? null}
                        dragOver={dragOverKey === sub.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverKey(sub.id); }}
                        onDragLeave={() => setDragOverKey((k) => (k === sub.id ? null : k))}
                        onDrop={handleDrop(sub.id)}
                        onRenamed={(n) => renameLocal(sub.id, n)}
                        onDeleted={() => deleteLocal(sub.id)}
                        onPriorityChanged={(p) => priorityLocal(sub.id, p)}
                      />
                    ))}
                    {addingSubTo === top.id && (
                      <div className="flex gap-1 px-2 py-1">
                        <input
                          autoFocus
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") submitNewProject(top.id);
                            if (e.key === "Escape") { setName(""); setAddingSubTo(null); }
                          }}
                          onBlur={() => { if (!name.trim()) setAddingSubTo(null); }}
                          placeholder="Название"
                          className="flex-1 border border-neutral-300 rounded px-2 py-1 text-xs"
                        />
                      </div>
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
