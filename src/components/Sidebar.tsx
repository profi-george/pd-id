"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { assignTaskToProject, createProject } from "@/app/actions";
import { buildProjectTree, type ProjectNode } from "@/lib/projectTree";

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
        <Link href="/today" className={rowClass(pathname === "/today", false)}>
          <span>Сегодня</span>
        </Link>
        <Link href="/backlog" className={rowClass(pathname === "/backlog", dragOverKey === "__all__")}>
          <span>Все задачи</span>
          <span className="text-xs opacity-60">{totalCount}</span>
        </Link>
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
        <div className="md:hidden pt-2 mt-2 border-t border-neutral-200 space-y-0.5">
          <Link href="/projects" className={rowClass(pathname === "/projects", false)}>
            <span>Проекты</span>
          </Link>
          <Link href="/settings" className={rowClass(pathname === "/settings", false)}>
            <span>Настройки</span>
          </Link>
        </div>
      </nav>

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
              <div className={rowClass(pathname === `/projects/${top.id}`, dragOverKey === top.id)}
                onDragOver={(e) => { e.preventDefault(); setDragOverKey(top.id); }}
                onDragLeave={() => setDragOverKey((k) => (k === top.id ? null : k))}
                onDrop={handleDrop(top.id)}
              >
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
                <Link href={`/projects/${top.id}`} className="flex-1 flex items-center justify-between min-w-0">
                  <span className="truncate">{top.name}</span>
                  <span className="text-xs opacity-60 ml-1">{counts[top.id] ?? 0}</span>
                </Link>
              </div>
              {!isCollapsed && (
              <div className="ml-3">
                {top.children.map((sub) => (
                  <Link
                    key={sub.id}
                    href={`/projects/${sub.id}`}
                                       onDragOver={(e) => { e.preventDefault(); setDragOverKey(sub.id); }}
                    onDragLeave={() => setDragOverKey((k) => (k === sub.id ? null : k))}
                    onDrop={handleDrop(sub.id)}
                    className={rowClass(pathname === `/projects/${sub.id}`, dragOverKey === sub.id)}
                  >
                    <span className="truncate text-neutral-600">— {sub.name}</span>
                    <span className="text-xs opacity-60">{counts[sub.id] ?? 0}</span>
                  </Link>
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
