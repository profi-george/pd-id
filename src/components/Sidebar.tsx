"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { assignTaskToProject, createProject, renameProject, deleteProject, setProjectPriority, setProjectColor } from "@/app/(app)/actions";
import { buildProjectTree, type ProjectNode } from "@/lib/projectTree";
import { PRIORITY_LABEL_TEXT, type PriorityLabel } from "@/lib/priorityEngine";
import { PROJECT_COLORS } from "@/lib/projectColors";
import {
  IconArrowLeft,
  IconChevronDown,
  IconChevronRight,
  IconHistory,
  IconInbox,
  IconMoon,
  IconMore,
  IconPlus,
  IconSun,
} from "@/components/icons";

const PROJECT_PRIORITY_OPTIONS: PriorityLabel[] = ["P0", "P1", "P2", "P3"];
const PROJECT_DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};
// Те же акценты, что и в PROJECT_DOT_CLASS выше, но как hex — для заливки
// всей строки проекта полупрозрачным цветом (см. projectRowTint ниже),
// а не только маленькой точки.
const PRIORITY_HEX: Record<PriorityLabel, string> = {
  P0: "#ef4444",
  P1: "#f59e0b",
  P2: "#60a5fa",
  P3: "#a3a3a3",
  LATER: "#a3a3a3",
};

// Раньше приоритет/цвет были двумя отдельными точками рядом с названием —
// вместо них вся строка проекта заливается полупрозрачным цветом приоритета,
// а сила заливки растёт с числом задач внутри (пусто — почти незаметно,
// много задач — заметно ярче). Без приоритета — нейтральный серый, тоже от
// количества задач, а не совсем без реакции.
//
// Формула прозрачности не менялась — это откалиброванный сигнал, а не
// оформление. Изменилось только то, что заливка дополнена вертикальным
// маркером слева (см. ниже): на светлой заливке при одной-двух задачах цвет
// почти не читался, а тонкая насыщенная полоска видна при любой плотности.
function projectRowTint(priority: string | null, count: number): React.CSSProperties {
  const valid: PriorityLabel | null =
    priority && PROJECT_PRIORITY_OPTIONS.includes(priority as PriorityLabel) ? (priority as PriorityLabel) : null;
  if (!valid && count === 0) return {};
  const hex = valid ? PRIORITY_HEX[valid] : "#a3a3a3";
  const alpha = Math.min(0.32, 0.05 + count * 0.025);
  const alphaHex = Math.round(alpha * 255).toString(16).padStart(2, "0");
  return { backgroundColor: `${hex}${alphaHex}` };
}

function projectRailColor(priority: string | null): string | null {
  const valid: PriorityLabel | null =
    priority && PROJECT_PRIORITY_OPTIONS.includes(priority as PriorityLabel) ? (priority as PriorityLabel) : null;
  return valid ? PRIORITY_HEX[valid] : null;
}

// Приоритет/цвет/переименовать/удалить — одно меню "⋯" вместо точек-триггеров
// рядом с названием (те заливают теперь всю строку, см. projectRowTint) и
// отдельного меню на каждое действие. "Назад" переключает между тремя видами
// одного и того же попапа, а не открывает вложенные меню друг над другом.
function ProjectMenu({
  priority,
  color,
  onRename,
  onDelete,
  onPriorityChanged,
  onColorChanged,
}: {
  priority: string | null;
  color: string | null;
  onRename: () => void;
  onDelete: () => void;
  onPriorityChanged: (p: PriorityLabel | null) => void;
  onColorChanged: (c: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "priority" | "color">("main");
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function close() {
    setOpen(false);
    setView("main");
  }

  const validPriority: PriorityLabel | null =
    priority && PROJECT_PRIORITY_OPTIONS.includes(priority as PriorityLabel) ? (priority as PriorityLabel) : null;

  return (
    <span ref={ref} className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => { setOpen((v) => !v); setView("main"); }}
        className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/70 transition-colors"
        aria-label="Действия с проектом"
      >
        <IconMore size={15} />
      </button>
      {open && view === "main" && (
        <div className="menu-panel absolute right-0 top-7 z-30 w-44">
          <button type="button" onClick={() => setView("priority")} className="menu-item justify-between">
            <span>Приоритет</span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              {validPriority && <span className={`w-1.5 h-1.5 rounded-full ${PROJECT_DOT_CLASS[validPriority]}`} />}
              {validPriority ? PRIORITY_LABEL_TEXT[validPriority] : "—"}
            </span>
          </button>
          <button type="button" onClick={() => setView("color")} className="menu-item justify-between">
            <span>Цвет ярлыка</span>
            <span
              className="w-3.5 h-3.5 rounded-full border border-neutral-200 shrink-0"
              style={color ? { backgroundColor: color } : undefined}
            />
          </button>
          <div className="my-1 border-t border-neutral-100" />
          <button type="button" onClick={() => { close(); onRename(); }} className="menu-item">
            Переименовать
          </button>
          <button type="button" onClick={() => { close(); onDelete(); }} className="menu-item menu-item-danger">
            Удалить
          </button>
        </div>
      )}
      {open && view === "priority" && (
        <div className="menu-panel absolute right-0 top-7 z-30 w-44">
          <button type="button" onClick={() => setView("main")} className="menu-item text-neutral-500">
            <IconArrowLeft size={13} /> Назад
          </button>
          <div className="my-1 border-t border-neutral-100" />
          <button
            type="button"
            onClick={() => { onPriorityChanged(null); close(); }}
            className="menu-item"
            data-active={!validPriority}
          >
            <span className="w-1.5 h-1.5 rounded-full border border-neutral-300" />
            Не задан
          </button>
          {PROJECT_PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => { onPriorityChanged(l); close(); }}
              className="menu-item"
              data-active={validPriority === l}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${PROJECT_DOT_CLASS[l]}`} />
              {PRIORITY_LABEL_TEXT[l]}
            </button>
          ))}
        </div>
      )}
      {open && view === "color" && (
        <div className="menu-panel absolute right-0 top-7 z-30 w-48">
          <button type="button" onClick={() => setView("main")} className="menu-item text-neutral-500">
            <IconArrowLeft size={13} /> Назад
          </button>
          <div className="my-1 border-t border-neutral-100" />
          <div className="grid grid-cols-5 gap-1.5 px-1.5 py-1">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => { onColorChanged(c.value); close(); }}
                title={c.name}
                aria-label={c.name}
                className={`w-5 h-5 rounded-full transition-transform hover:scale-110 ${
                  color === c.value ? "ring-2 ring-offset-2 ring-neutral-400" : ""
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
          <button type="button" onClick={() => { onColorChanged(null); close(); }} className="menu-item text-neutral-500">
            Без цвета
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
  color,
  onDragOver,
  onDragLeave,
  onDrop,
  dragOver,
  onRenamed,
  onDeleted,
  onPriorityChanged,
  onColorChanged,
  onAddChild,
}: {
  id: string;
  name: string;
  count: number;
  active: boolean;
  priority: string | null;
  color: string | null;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onRenamed: (name: string) => void;
  onDeleted: () => void;
  onPriorityChanged: (p: string | null) => void;
  onColorChanged: (c: string | null) => void;
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

  function handleColorPick(c: string | null) {
    onColorChanged(c);
    startTransition(() => { setProjectColor(id, c); });
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
      <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs bg-red-50 border border-red-100 rounded-lg animate-fade-in">
        <span className="flex-1 truncate text-red-700">Удалить «{name}»?</span>
        <button
          type="button"
          onClick={() => setConfirmingDelete(false)}
          className="btn btn-secondary btn-sm shrink-0"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={remove}
          className="btn btn-sm bg-red-600 text-white hover:bg-red-700 shrink-0"
        >
          Удалить
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className="px-0.5 py-0.5">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") { setValue(name); setEditing(false); }
          }}
          className="field field-sm"
        />
      </div>
    );
  }

  const rail = projectRailColor(priority);

  return (
    <div
      className={`group relative flex items-center gap-1 rounded-lg pl-2.5 pr-1 py-1.5 text-[13px] overflow-hidden transition-colors ${
        dragOver
          ? "bg-ink-50 ring-1 ring-ink-300"
          : active
          ? "bg-white text-neutral-900 font-medium shadow-xs ring-1 ring-neutral-200"
          : "text-neutral-700 hover:bg-neutral-200/50"
      }`}
      style={!dragOver && !active ? projectRowTint(priority, count) : undefined}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Вертикальный маркер приоритета: заливка строки говорит «сколько тут
          задач», полоска — «какой это приоритет». На пустом проекте заливки
          почти нет, и без полоски приоритет был не виден вовсе. */}
      {rail && (
        <span
          aria-hidden
          className="absolute left-0 inset-y-1 w-[3px] rounded-full"
          style={{ backgroundColor: rail }}
        />
      )}
      <Link href={`/projects/${id}`} className="flex-1 min-w-0 flex items-center justify-between gap-2 py-0.5">
        <span className="truncate">{name}</span>
        {count > 0 && (
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums shrink-0 transition-opacity group-hover:opacity-0 ${
              active ? "bg-ink-50 text-ink-700" : "bg-neutral-900/5 text-neutral-500"
            }`}
          >
            {count}
          </span>
        )}
      </Link>
      {/* Действия проявляются на месте счётчика, а не раздвигают строку —
          раньше при наведении название дёргалось влево. pointer-events-none
          в покое обязателен: невидимый слой поверх правого края строки иначе
          съедал бы клики по самой ссылке проекта. */}
      <span className="absolute right-1 flex items-center gap-0.5 shrink-0 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto focus-within:opacity-100 focus-within:pointer-events-auto transition-opacity">
        {onAddChild && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/70 transition-colors"
            title="Новый проект"
            aria-label="Добавить проект внутри"
          >
            <IconPlus size={14} />
          </button>
        )}
        <ProjectMenu
          priority={priority}
          color={color}
          onRename={() => setEditing(true)}
          onDelete={() => setConfirmingDelete(true)}
          onPriorityChanged={handlePriorityPick}
          onColorChanged={handleColorPick}
        />
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

  function colorLocal(id: string, color: string | null) {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, color } : p)));
  }

  // Активный пункт — приподнятая белая карточка, а не чёрная заливка.
  // Тёмный блок в сайдбаре перетягивал внимание на навигацию, хотя смотреть
  // надо в список задач справа.
  const navRow = (active: boolean, dragOver: boolean) =>
    `group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
      dragOver
        ? "bg-ink-50 ring-1 ring-ink-300 text-ink-700"
        : active
        ? "bg-white text-neutral-900 font-medium shadow-xs ring-1 ring-neutral-200"
        : "text-neutral-600 hover:bg-neutral-200/50 hover:text-neutral-900"
    }`;

  const navIcon = (active: boolean) => (active ? "text-ink-600 shrink-0" : "text-neutral-400 shrink-0 group-hover:text-neutral-600 transition-colors");

  const planActive = pathname === "/today";
  const summaryActive = pathname === "/today/summary";
  const historyActive = pathname === "/history";

  return (
    <aside className="w-60 shrink-0 border-r border-neutral-200 bg-neutral-50 h-full overflow-y-auto flex flex-col gap-5 px-2.5 py-4">
      <nav className="space-y-0.5">
        <Link href="/today" className={navRow(planActive, false)}>
          <IconSun size={16} className={navIcon(planActive)} />
          <span className="flex-1">План дня</span>
          {totalCount > 0 && (
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums ${planActive ? "bg-ink-50 text-ink-700" : "bg-neutral-900/5 text-neutral-500"}`}>
              {totalCount}
            </span>
          )}
        </Link>
        <Link href="/today/summary" className={navRow(summaryActive, false)}>
          <IconMoon size={16} className={navIcon(summaryActive)} />
          <span className="flex-1">Итог дня</span>
        </Link>
        <Link href="/history" className={navRow(historyActive, false)}>
          <IconHistory size={16} className={navIcon(historyActive)} />
          <span className="flex-1">История</span>
        </Link>
      </nav>

      {/* Граница перед "Проекты" — иначе он визуально сливается с основной
          навигацией выше, хотя это разные по смыслу категории. */}
      <div className="pt-4 border-t border-neutral-200 flex-1 min-h-0">
        <div className="flex items-center justify-between pl-2.5 pr-1 mb-1.5">
          <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.08em]">Проекты</p>
          <button
            type="button"
            onClick={() => { setAdding((v) => !v); setName(""); }}
            className="w-6 h-6 flex items-center justify-center rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-200/70 transition-colors"
            title="Новый проект"
            aria-label="Новый проект"
          >
            <IconPlus size={14} />
          </button>
        </div>

        {adding && (
          <div className="px-0.5 py-1">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitNewProject(null);
                if (e.key === "Escape") { setName(""); setAdding(false); }
              }}
              placeholder="Название проекта"
              className="field field-sm"
            />
          </div>
        )}

        <div className="space-y-0.5">
          {tree.map((top) => {
            const isCollapsed = collapsed.has(top.id);
            return (
              <div key={top.id}>
                {/* Раскрывашка наезжает в левый паддинг сайдбара (relative +
                    absolute со сдвигом влево), а не занимает свою колонку в потоке —
                    иначе название проекта уезжало заметно правее, чем "Проекты"
                    и остальные пункты навигации над ними. */}
                <div className="relative">
                  {top.children.length > 0 && (
                    <button
                      type="button"
                      onClick={() => toggleCollapsed(top.id)}
                      className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-3.5 w-4 h-4 flex items-center justify-center text-neutral-400 hover:text-neutral-800 transition-colors z-10"
                      aria-label={isCollapsed ? "Развернуть проект" : "Свернуть проект"}
                    >
                      {isCollapsed ? <IconChevronRight size={12} /> : <IconChevronDown size={12} />}
                    </button>
                  )}
                  <ProjectRow
                    id={top.id}
                    name={top.name}
                    count={counts[top.id] ?? 0}
                    active={pathname === `/projects/${top.id}`}
                    priority={top.priority ?? null}
                    color={top.color ?? null}
                    dragOver={dragOverKey === top.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverKey(top.id); }}
                    onDragLeave={() => setDragOverKey((k) => (k === top.id ? null : k))}
                    onDrop={handleDrop(top.id)}
                    onRenamed={(n) => renameLocal(top.id, n)}
                    onDeleted={() => deleteLocal(top.id)}
                    onPriorityChanged={(p) => priorityLocal(top.id, p)}
                    onColorChanged={(c) => colorLocal(top.id, c)}
                    onAddChild={() => { setAddingSubTo(top.id); setName(""); }}
                  />
                </div>
                {!isCollapsed && (top.children.length > 0 || addingSubTo === top.id) && (
                  // Тонкая линия слева — вложенность видна сама, без подписи "подпроект".
                  <div className="ml-3 pl-2 border-l border-neutral-200 space-y-0.5 mt-0.5">
                    {top.children.map((sub) => (
                      <ProjectRow
                        key={sub.id}
                        id={sub.id}
                        name={sub.name}
                        count={counts[sub.id] ?? 0}
                        active={pathname === `/projects/${sub.id}`}
                        priority={sub.priority ?? null}
                        color={sub.color ?? null}
                        dragOver={dragOverKey === sub.id}
                        onDragOver={(e) => { e.preventDefault(); setDragOverKey(sub.id); }}
                        onDragLeave={() => setDragOverKey((k) => (k === sub.id ? null : k))}
                        onDrop={handleDrop(sub.id)}
                        onRenamed={(n) => renameLocal(sub.id, n)}
                        onDeleted={() => deleteLocal(sub.id)}
                        onPriorityChanged={(p) => priorityLocal(sub.id, p)}
                        onColorChanged={(c) => colorLocal(sub.id, c)}
                      />
                    ))}
                    {addingSubTo === top.id && (
                      <div className="px-0.5 py-1">
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
                          className="field field-sm"
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

      <div
        className="pt-3 border-t border-neutral-200"
        onDragOver={(e) => { e.preventDefault(); setDragOverKey("__none__"); }}
        onDragLeave={() => setDragOverKey((k) => (k === "__none__" ? null : k))}
        onDrop={handleDrop(null)}
      >
        <Link href="/today?view=all&project=none" className={navRow(false, dragOverKey === "__none__")}>
          <IconInbox size={16} className={navIcon(false)} />
          <span className="flex-1">Без проекта</span>
          {noProjectCount > 0 && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-md tabular-nums bg-neutral-900/5 text-neutral-500">
              {noProjectCount}
            </span>
          )}
        </Link>
      </div>
    </aside>
  );
}
