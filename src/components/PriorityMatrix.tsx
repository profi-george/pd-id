"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  LOW_CONFIDENCE_THRESHOLD,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import { formatDateRelative, parseDateInputValue, todayDate, toDateInputValue, nextMonday, sameDate } from "@/lib/dates";
import { tasksWord } from "@/lib/pluralize";
import {
  deleteTask,
  completeTask,
  revertTaskStatus,
  undoMoveTask,
  scheduleTask,
  scheduleTaskToDate,
  unscheduleTask,
  setManualPriority,
  assignTaskToProject,
  reorderPriorityTask,
  updateTaskFields,
  addTaskToGoogleCalendar,
  removeTaskFromGoogleCalendar,
  addSubtask,
  toggleSubtask,
  renameSubtask,
  deleteSubtask,
  scheduleSubtask,
  splitPartialTask,
} from "@/app/(app)/actions";
import TaskDrawer, { type DrawerTask, type SubtaskItem } from "@/components/TaskDrawer";
import PartialCompleteDialog from "@/components/PartialCompleteDialog";
import {
  IconCalendarArrow,
  IconCheck,
  IconMore,
  IconPlus,
  IconChevronDown,
  IconArrowRight,
  IconBookOpen,
  IconListChecks,
} from "@/components/icons";

export type MatrixTask = TaskEvaluation & {
  id: string;
  text: string;
  status?: string;
  projectId: string | null;
  projectName: string | null;
  projectColor?: string | null;
  date?: Date | null;
  movedToDate?: Date | null;
  subtasks?: SubtaskItem[];
  manualRank?: number | null;
  confidenceReason?: string | null;
  googleEventId?: string | null;
  googleEventUrl?: string | null;
  aiValue?: number | null;
  aiCostOfDelay?: number | null;
  aiUrgency?: number | null;
  aiTimeSensitivity?: number | null;
  aiEffortMinutes?: number | null;
  aiReasoningValue?: string | null;
  aiReasoningCostOfDelay?: string | null;
  aiReasoningUrgency?: string | null;
  aiReasoningTimeSensitivity?: string | null;
  aiReasoningEffort?: string | null;
};

const COLUMN_ORDER: ("P0" | "P1" | "P2" | "P3")[] = ["P0", "P1", "P2", "P3"];

const DOT_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-500",
  P1: "bg-amber-500",
  P2: "bg-blue-400",
  P3: "bg-neutral-400",
  LATER: "bg-neutral-300",
};

// Вертикальная «рельса» приоритета слева от строки задачи. Раньше это была
// border-l-2 на всю высоту строки — при плотном списке она сливалась
// в одну сплошную полосу вдоль экрана и переставала читаться как маркер
// конкретной задачи. Теперь это отдельная короткая скруглённая полоска
// с отступом сверху/снизу: каждая задача видна как своя единица.
const RAIL_CLASS: Record<PriorityLabel, string> = {
  P0: "bg-red-400",
  P1: "bg-amber-400",
  P2: "bg-blue-300",
  P3: "bg-neutral-300",
  LATER: "bg-neutral-200",
};

// Рамка hero-карточки "Сейчас" берёт цвет из приоритета САМОЙ задачи вместо
// фиксированного индиго — точка приоритета и обводка карточки говорят одно
// и то же, а не спорят двумя разными акцентами.
const HERO_RING_CLASS: Record<PriorityLabel, string> = {
  P0: "ring-red-200 bg-gradient-to-b from-red-50/80 to-white",
  P1: "ring-amber-200 bg-gradient-to-b from-amber-50/80 to-white",
  P2: "ring-blue-200 bg-gradient-to-b from-blue-50/80 to-white",
  P3: "ring-neutral-200 bg-gradient-to-b from-neutral-50 to-white",
  LATER: "ring-neutral-200 bg-gradient-to-b from-neutral-50 to-white",
};

const HERO_SCORE_CLASS: Record<PriorityLabel, string> = {
  P0: "border-red-200 text-red-700 bg-white",
  P1: "border-amber-200 text-amber-700 bg-white",
  P2: "border-blue-200 text-blue-700 bg-white",
  P3: "border-neutral-200 text-neutral-700 bg-white",
  LATER: "border-neutral-200 text-neutral-600 bg-white",
};

const GROUP_PREVIEW = 3;

// Матрица 2×2 — та же шкала приоритета (P0–P3), что и в обычном списке, просто
// разложена по квадрантам вместо секций друг под другом. Фон квадранта — очень
// светлый тон того же акцента, что и точка/рамка приоритета в списке, чтобы
// матрица не вводила свою отдельную цветовую систему; карточки внутри остаются
// белыми (см. п.18-19 ТЗ — цвет для ориентации по сетке, а не для украшения).
const QUADRANT_CLASS: Record<"P0" | "P1" | "P2" | "P3", string> = {
  P0: "bg-red-50/60 ring-red-100",
  P1: "bg-amber-50/60 ring-amber-100",
  P2: "bg-blue-50/60 ring-blue-100",
  P3: "bg-neutral-100/60 ring-neutral-200",
};

// Раньше клик по этой иконке сразу переносил задачу на завтра — молча, без
// возможности передумать или выбрать другой день. Перенос это решение не менее
// значимое, чем сама дата выполнения, поэтому здесь тот же принцип, что и в
// карточке задачи: явный выбор — "Завтра" или конкретная дата, не автоматика.
function MovePicker({
  onScheduleTomorrow,
  onScheduleDate,
}: {
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
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
    <span ref={ref} className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="icon-btn hover:text-ink-600"
        aria-label="Перенести"
        title="Перенести"
      >
        <IconCalendarArrow size={15} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="menu-panel absolute right-0 top-8 z-20 w-44 space-y-1"
        >
          <button
            type="button"
            onClick={() => { setOpen(false); onScheduleTomorrow(); }}
            className="menu-item"
          >
            Завтра
          </button>
          <div className="px-1 pb-0.5">
            <input
              type="date"
              aria-label="Перенести на дату"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (!e.target.value) return;
                setOpen(false);
                onScheduleDate(e.target.value);
              }}
              className="field field-sm"
            />
          </div>
        </div>
      )}
    </span>
  );
}

function QuickMenu({
  status,
  scheduled,
  onDelete,
  onUnschedule,
  onComplete,
  onRevert,
  onScheduleTomorrow,
  onScheduleDate,
  onPartialComplete,
  hideCheckToggle = false,
  taskId,
  taskText,
}: {
  status?: string;
  scheduled: boolean;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
  onRevert: () => void;
  onScheduleTomorrow?: () => void;
  onScheduleDate?: (dateISO: string) => void;
  onPartialComplete?: () => void;
  // На hero-карточке ("Сейчас") отметка о выполнении уже есть отдельной крупной
  // кнопкой в теле карточки — второй маленький ✓ в этом меню был бы дублем.
  hideCheckToggle?: boolean;
  taskId: string;
  taskText: string;
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

  // Отметить/снять отметку — переключатель между PLANNED и DONE/PARTIAL. Для
  // "не выполнена"/"перенесена" тут кнопки нет намеренно: снятие статуса там
  // задевает вторую запись (дубликат на другом дне) или данные "Итога дня",
  // это отдельное, более осторожное действие, не однокликовое.
  const canToggle = status === "PLANNED" || status === "DONE" || status === "PARTIAL" || status === undefined;
  // Уже строже, чем canToggle — DONE/PARTIAL не должны молча терять отметку
  // о выполнении через "перенести", даже если ✓ (вернуть в план) им доступен.
  const canReschedule = status === "PLANNED" || status === undefined;

  const isDone = status === "DONE" || status === "PARTIAL";

  return (
    <span className="flex items-center shrink-0">
      {canToggle && !hideCheckToggle && !isDone && (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onComplete(); }}
          className="icon-btn hover:!text-emerald-600 hover:!bg-emerald-50"
          aria-label="Выполнено"
          title="Отметить выполненной"
        >
          <IconCheck size={15} />
        </button>
      )}
      {canToggle && !hideCheckToggle && isDone && (
        <span
          className="w-7 h-7 flex items-center justify-center rounded-md text-emerald-600"
          aria-hidden
          title="Выполнено"
        >
          <IconCheck size={15} />
        </span>
      )}
      {canReschedule && onScheduleTomorrow && onScheduleDate && (
        <MovePicker onScheduleTomorrow={onScheduleTomorrow} onScheduleDate={onScheduleDate} />
      )}
      <span ref={ref} className="relative">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
          className="icon-btn"
          aria-label="Действия"
        >
          <IconMore size={15} />
        </button>
        {open && (
          <div className="menu-panel absolute right-0 top-8 z-20 w-48">
            {scheduled && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onUnschedule(); }}
                className="menu-item"
              >
                Убрать из плана
              </button>
            )}
            {isDone && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onRevert(); }}
                className="menu-item"
              >
                Вернуть в план
              </button>
            )}
            {canToggle && onPartialComplete && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(false); onPartialComplete(); }}
                className="menu-item"
              >
                Частично выполнено…
              </button>
            )}
            <a
              href={`https://dnevnik-gold.vercel.app/diary/bulk?text=${encodeURIComponent(taskText)}&taskId=${encodeURIComponent(taskId)}`}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => { e.stopPropagation(); setOpen(false); }}
              className="menu-item justify-between"
            >
              <span className="flex items-center gap-2">
                <IconBookOpen size={14} className="text-neutral-400 shrink-0" />
                Записать в Дневник
              </span>
              <IconArrowRight size={13} className="text-neutral-400 shrink-0" />
            </a>
            <div className="my-1 border-t border-neutral-100" />
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onDelete(); }}
              className="menu-item menu-item-danger"
            >
              Удалить
            </button>
          </div>
        )}
      </span>
    </span>
  );
}

const PRIORITY_OPTIONS: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];

// Смена приоритета одним тапом прямо в списке — не открывая карточку задачи.
function PriorityPicker({ label, onPick }: { label: PriorityLabel; onPick: (l: PriorityLabel) => void }) {
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
    <span ref={ref} className="relative shrink-0 pl-1.5 pt-3">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="group/dot flex items-center justify-center w-7 h-7 rounded-full hover:bg-neutral-100 transition-colors"
        aria-label={`Приоритет: ${PRIORITY_LABEL_TEXT[label]}. Изменить`}
        title={`Приоритет: ${PRIORITY_LABEL_TEXT[label]}`}
      >
        {/* Кольцо вокруг точки появляется только под курсором — в покое это
            чистый маркер, под курсором — очевидно кликабельный орган. */}
        <span className={`w-2.5 h-2.5 rounded-full ring-0 ring-neutral-300 group-hover/dot:ring-4 transition-all ${DOT_CLASS[label]}`} />
      </button>
      {open && (
        <div className="menu-panel absolute left-0 top-8 z-20 w-44">
          {PRIORITY_OPTIONS.map((l) => (
            <button
              key={l}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(l); }}
              className="menu-item"
              data-active={l === label}
            >
              <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[l]}`} />
              {PRIORITY_LABEL_TEXT[l]}
              {l === label && <IconCheck size={13} className="ml-auto text-ink-600" />}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Смена проекта одним тапом прямо в списке — не открывая карточку задачи.
function ProjectPicker({
  projectId,
  projectName,
  projectColor,
  options,
  onPick,
}: {
  projectId: string | null;
  projectName: string | null;
  projectColor?: string | null;
  options: { id: string; label: string; color?: string | null }[];
  onPick: (projectId: string | null) => void;
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
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`inline-flex items-center gap-1.5 rounded-md -mx-1 px-1 -my-0.5 py-0.5 transition-colors hover:bg-neutral-100 hover:text-neutral-800 ${
          projectName ? "" : "text-neutral-400"
        }`}
      >
        {projectColor && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: projectColor }} />}
        {projectName ?? "+ проект"}
      </button>
      {open && (
        <div className="menu-panel absolute left-0 top-6 z-20 w-52 max-h-64 overflow-y-auto">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(null); }}
            className="menu-item"
            data-active={!projectId}
          >
            Без проекта
          </button>
          {options.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onPick(p.id); }}
              className="menu-item"
              data-active={p.id === projectId}
            >
              {p.color && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />}
              <span className="truncate">{p.label}</span>
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Смена даты одним тапом прямо в списке — не открывая карточку задачи.
function DatePicker({
  date,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
}: {
  date: Date | null | undefined;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
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
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className={`rounded-md -mx-1 px-1 -my-0.5 py-0.5 transition-colors hover:bg-neutral-100 ${
          date ? "text-ink-600 hover:text-ink-700" : "text-neutral-400 hover:text-neutral-700"
        }`}
      >
        {date ? `на ${formatDateRelative(date)}` : "+ дата"}
      </button>
      {open && (
        <div className="menu-panel absolute left-0 top-6 z-20 w-52 space-y-1">
          <div className="flex gap-1 p-0.5">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onScheduleToday(); }}
              className="btn btn-secondary btn-sm flex-1"
            >
              Сегодня
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(false); onScheduleTomorrow(); }}
              className="btn btn-secondary btn-sm flex-1"
            >
              Завтра
            </button>
          </div>
          <div className="px-0.5 pb-0.5">
            <input
              type="date"
              aria-label="Выбрать дату"
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (!e.target.value) return;
                setOpen(false);
                onScheduleDate(e.target.value);
              }}
              className="field field-sm"
            />
          </div>
        </div>
      )}
    </span>
  );
}

// Тот же принцип, что и MovePicker выше — один "Перенести" вместо четырёх
// отдельных кнопок (Сегодня/Завтра/Понедельник/На дату), которые вместе с
// "Выполнено"/"Удалить" не помещались в один ряд тулбара выбранных задач.
// Раскрывается вверх — тулбар сам прижат к низу экрана.
function BulkMovePicker({
  showToday,
  onToday,
  onTomorrow,
  onMonday,
  onDate,
}: {
  // Скрыта, когда у всех выбранных и так уже сегодняшняя дата — перенос "на
  // сегодня" в этом случае ничего не делает и выглядит бессмысленной кнопкой.
  showToday: boolean;
  onToday: () => void;
  onTomorrow: () => void;
  onMonday: () => void;
  onDate: (dateISO: string) => void;
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
    <span ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="toast-btn">
        Перенести
      </button>
      {open && (
        <div className="menu-panel menu-panel-up absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-20 w-44">
          {showToday && (
            <button type="button" onClick={() => { setOpen(false); onToday(); }} className="menu-item">
              Сегодня
            </button>
          )}
          <button type="button" onClick={() => { setOpen(false); onTomorrow(); }} className="menu-item">
            Завтра
          </button>
          <button type="button" onClick={() => { setOpen(false); onMonday(); }} className="menu-item">
            Понедельник
          </button>
          <div className="px-1 pt-1 pb-0.5">
            <input
              type="date"
              aria-label="Перенести на дату"
              onChange={(e) => { if (e.target.value) { setOpen(false); onDate(e.target.value); } }}
              className="field field-sm"
            />
          </div>
        </div>
      )}
    </span>
  );
}

function TaskRow({
  task,
  color,
  projectOptions,
  onOpen,
  onDropBefore,
  onDelete,
  onUnschedule,
  onComplete,
  onRevert,
  onUndoMove,
  onManualPriority,
  onAssignProject,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
  selected,
  selectionActive,
  onToggleSelect,
  onPartialComplete,
  hero = false,
  compact = false,
}: {
  task: MatrixTask;
  color: PriorityLabel;
  projectOptions: { id: string; label: string; color?: string | null }[];
  onOpen: () => void;
  onDropBefore: (draggedId: string, before: boolean) => void;
  onDelete: () => void;
  onUnschedule: () => void;
  onComplete: () => void;
  onRevert: () => void;
  onUndoMove: () => Promise<boolean>;
  onManualPriority: (label: PriorityLabel) => void;
  onAssignProject: (projectId: string | null) => void;
  onScheduleToday: () => void;
  onScheduleTomorrow: () => void;
  onScheduleDate: (dateISO: string) => void;
  selected: boolean;
  // true, если хоть одна задача в списке уже выбрана — тогда обычный тап по
  // строке тоже добавляет/убирает из выбора, а не открывает карточку.
  selectionActive: boolean;
  onToggleSelect: () => void;
  onPartialComplete: () => void;
  // Карточка "Сейчас" наверху экрана дня: крупная кнопка выполнения и балл
  // приоритета видны сразу, без похода в детали задачи.
  hero?: boolean;
  // Квадрант матрицы: только чекбокс и название, без проекта/срока/статусных
  // бейджей и точки приоритета (она и так очевидна из квадранта) — все
  // пояснения по задаче остаются в карточке, открывается по клику.
  compact?: boolean;
}) {
  const [dragOver, setDragOver] = useState<"top" | "bottom" | null>(null);
  // Быстрые правки прямо в списке (приоритет/проект/дата) иначе проходят молча —
  // секундная сетевая заминка выглядела бы точно как сбой. Короткая вспышка "✓"
  // подтверждает, что тап действительно принят, тем же языком, что уже есть
  // в карточке задачи ("✓ Сохранено").
  const [flash, setFlash] = useState(false);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimer.current) clearTimeout(flashTimer.current); }, []);
  function triggerFlash() {
    setFlash(true);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    flashTimer.current = setTimeout(() => setFlash(false), 1200);
  }


  // Отмена переноса — своё состояние: пока ждём ответ сервера, кнопка неактивна;
  // если копию уже успели изменить, отменить нельзя — показываем это тут же,
  // рядом с местом, где человек об этом узнаёт, а не в общем алерте.
  const [undoMoveState, setUndoMoveState] = useState<"idle" | "pending" | "error">("idle");
  async function handleUndoMoveClick() {
    setUndoMoveState("pending");
    const ok = await onUndoMove();
    setUndoMoveState(ok ? "idle" : "error");
  }

  // DONE/MOVED не должны молча терять отметку о выполнении через перенос —
  // тот же критерий, что и MovePicker в QuickMenu.
  const canReschedule = task.status === "PLANNED" || task.status === undefined;

  return (
    <div
      draggable
      onDragStart={(e) => { e.dataTransfer.setData("text/plain", task.id); }}
      onDragOver={(e) => {
        e.preventDefault();
        const rect = e.currentTarget.getBoundingClientRect();
        setDragOver(e.clientY < rect.top + rect.height / 2 ? "top" : "bottom");
      }}
      onDragLeave={() => setDragOver(null)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation(); // иначе drop всплывает до контейнера группы и тот перебивает вставку, всегда добавляя в конец
        const draggedId = e.dataTransfer.getData("text/plain");
        const before = dragOver !== "bottom";
        setDragOver(null);
        if (draggedId) onDropBefore(draggedId, before);
      }}
      className={`group relative flex items-start rounded-lg transition-colors ${
        selected ? "bg-ink-50/70" : "hover:bg-neutral-50"
      }`}
    >
      {/* Маркер вставки при перетаскивании — абсолютная линия, а не border:
          border добавлял высоту и весь список дёргался на 2px под курсором. */}
      {dragOver && (
        <span
          aria-hidden
          // pointer-events-none обязательно: иначе полоска попадает под курсор
          // во время перетаскивания, перехватывает dragover у самой строки,
          // и маркер начинает мигать между «вставить сверху» и «снизу».
          className={`pointer-events-none absolute left-0 right-0 h-0.5 bg-ink-500 rounded-full z-10 ${
            dragOver === "top" ? "-top-px" : "-bottom-px"
          }`}
        >
          <span className="absolute -left-0.5 -top-[3px] w-2 h-2 rounded-full bg-ink-500" />
        </span>
      )}

      {/* Рельса приоритета. Её нет у hero-карточки (там цвет приоритета несёт
          вся карточка целиком) и в компактном режиме матрицы — там приоритет
          и так задан квадрантом, полоска была бы третьим повтором одного
          и того же. */}
      {!hero && !compact && (
        <span
          aria-hidden
          className={`pointer-events-none absolute left-0 top-2.5 bottom-2.5 w-0.5 rounded-full ${RAIL_CLASS[color]}`}
        />
      )}

      <label
        className={`${compact ? "pt-2.5" : "pt-4"} pl-2.5 pr-0.5 shrink-0 self-start`}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggleSelect()}
          className="opacity-0 checked:opacity-100 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity"
          aria-label={selected ? "Убрать из выделения" : "Выделить для массового действия"}
          title={selected ? "Убрать из выделения" : "Выделить для массового действия"}
        />
      </label>
      {!compact && <PriorityPicker label={color} onPick={(l) => { onManualPriority(l); triggerFlash(); }} />}
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          if (selectionActive) onToggleSelect();
          else onOpen();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        className={`flex-1 min-w-0 text-left pr-3 cursor-grab active:cursor-grabbing ${
          compact ? "py-2 pl-1" : "py-3 space-y-1.5"
        }`}
      >
        <p
          className={`${compact ? "text-[13px]" : "text-[15px]"} leading-snug font-medium tracking-[-0.01em] ${
            task.status === "MOVED"
              ? "line-through text-neutral-400"
              : task.status === "NOT_DONE"
              ? "text-neutral-500"
              : "text-neutral-900"
          }`}
        >
          {task.text}
        </p>
        {!compact && (
          <>
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs text-neutral-500">
              {task.subtasks && task.subtasks.length > 0 && (
                <span
                  className={`inline-flex items-center gap-1 tabular-nums ${
                    task.subtasks.every((s) => s.done) ? "text-emerald-600" : ""
                  }`}
                >
                  <IconListChecks size={13} className="shrink-0" />
                  {task.subtasks.filter((s) => s.done).length}/{task.subtasks.length}
                </span>
              )}
              <ProjectPicker
                projectId={task.projectId}
                projectName={task.projectName}
                projectColor={task.projectColor}
                options={projectOptions}
                onPick={(id) => { onAssignProject(id); triggerFlash(); }}
              />
              <span className="text-neutral-400 tabular-nums">≈&nbsp;{formatEffort(task.effortMinutes)}</span>
              {canReschedule ? (
                <DatePicker
                  date={task.date}
                  onScheduleToday={() => { onScheduleToday(); triggerFlash(); }}
                  onScheduleTomorrow={() => { onScheduleTomorrow(); triggerFlash(); }}
                  onScheduleDate={(d) => { onScheduleDate(d); triggerFlash(); }}
                />
              ) : (
                task.date && (
                  // Уже выполненную/перенесённую задачу нельзя перенести отсюда одним
                  // кликом — это молча сняло бы отметку. Дата видна, но не кликабельна.
                  <span className="text-neutral-400" title="Перенести можно после отмены выполнения">
                    на {formatDateRelative(task.date)}
                  </span>
                )
              )}
            </div>
            {(task.status === "DONE" ||
              task.status === "NOT_DONE" ||
              task.status === "MOVED" ||
              task.status === "PARTIAL" ||
              task.confidence < LOW_CONFIDENCE_THRESHOLD ||
              flash) && (
              <div className="flex flex-wrap items-center gap-1.5">
                {task.status === "DONE" && (
                  <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                    <IconCheck size={11} className="shrink-0" />
                    выполнена
                  </span>
                )}
                {task.status === "PARTIAL" && (
                  <span className="chip bg-blue-50 text-blue-700 ring-1 ring-blue-100">
                    частично{task.movedToDate ? ` · продолжение → ${formatDateRelative(task.movedToDate)}` : ""}
                  </span>
                )}
                {task.status === "NOT_DONE" && (
                  <span className="chip bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200">не выполнена</span>
                )}
                {task.status === "MOVED" && undoMoveState !== "error" && (
                  <span className="chip bg-neutral-100 text-neutral-500 ring-1 ring-neutral-200">
                    перенесена{task.movedToDate ? ` → ${formatDateRelative(task.movedToDate)}` : ""}
                    <button
                      type="button"
                      disabled={undoMoveState === "pending"}
                      onClick={(e) => { e.stopPropagation(); handleUndoMoveClick(); }}
                      className="underline underline-offset-2 hover:text-neutral-800 disabled:opacity-50 transition-colors"
                    >
                      {undoMoveState === "pending" ? "отменяю…" : "отменить"}
                    </button>
                  </span>
                )}
                {task.status === "MOVED" && undoMoveState === "error" && (
                  <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100">
                    перенос уже нельзя отменить — копия изменена
                  </span>
                )}
                {task.confidence < LOW_CONFIDENCE_THRESHOLD && (
                  <span className="chip bg-amber-50 text-amber-700 ring-1 ring-amber-100">AI не уверен</span>
                )}
                {flash && (
                  <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 animate-fade-in">
                    <IconCheck size={11} className="shrink-0" />
                    Сохранено
                  </span>
                )}
              </div>
            )}
            {task.primaryReason && (
              <p className="ai-note text-xs leading-snug">{task.primaryReason}</p>
            )}
            {task.note && (
              <p className="text-xs text-neutral-500 border-l-2 border-neutral-200 pl-2 leading-snug">
                {task.note}
              </p>
            )}
          </>
        )}
        {hero && (task.status === "PLANNED" || task.status === undefined || task.status === "DONE" || task.status === "PARTIAL") && (
          <div className="pt-2" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => { if (task.status === "DONE" || task.status === "PARTIAL") onRevert(); else onComplete(); }}
              className={`btn btn-lg ${
                task.status === "DONE" || task.status === "PARTIAL"
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
                  : "btn-primary"
              }`}
            >
              {task.status === "DONE" || task.status === "PARTIAL" ? (
                <>
                  <IconCheck size={15} className="shrink-0" />
                  Выполнено — вернуть в план
                </>
              ) : (
                <>
                  <IconCheck size={15} className="shrink-0" />
                  Выполнить
                </>
              )}
            </button>
          </div>
        )}
      </div>
      {/* Ряд действий приглушён в покое и становится полностью контрастным под
          курсором/при фокусе с клавиатуры — иконки не должны спорить с текстом
          задачи, но и прятаться совсем им нельзя: это ежедневный инструмент,
          действия ищут глазами, а не наводят мышь наугад. */}
      <div
        className={`${hero ? "pt-3 pr-3" : "pt-1.5 pr-1.5"} flex items-center gap-0.5 opacity-60 group-hover:opacity-100 focus-within:opacity-100 transition-opacity`}
      >
        {hero && (
          <span
            className={`mr-1 w-10 h-10 rounded-full border shadow-xs flex items-center justify-center shrink-0 tabular-nums ${HERO_SCORE_CLASS[color]}`}
            title="Приоритетный балл"
          >
            <span className="text-[13px] font-bold leading-none">{computePriority(task).scorePercent}</span>
          </span>
        )}
        <QuickMenu
          status={task.status}
          scheduled={Boolean(task.date)}
          onDelete={onDelete}
          onUnschedule={onUnschedule}
          onComplete={onComplete}
          onRevert={onRevert}
          onScheduleTomorrow={() => { onScheduleTomorrow(); triggerFlash(); }}
          onScheduleDate={(d) => { onScheduleDate(d); triggerFlash(); }}
          onPartialComplete={onPartialComplete}
          hideCheckToggle={hero}
          taskId={task.id}
          taskText={task.text}
        />
      </div>
    </div>
  );
}

// DONE/NOT_DONE/MOVED/PARTIAL — всё, что больше не "предстоит": закрыто,
// неважно с каким исходом. Один и тот же критерий для вкладок План дня/Все задачи.
function statusBucket(status?: string): "upcoming" | "done" {
  if (status === "DONE" || status === "NOT_DONE" || status === "MOVED" || status === "PARTIAL") return "done";
  return "upcoming";
}

export default function PriorityMatrix({
  tasks,
  projectOptions,
  googleConnected = false,
  planView = false,
  emptyMessage = "Здесь пока пусто.",
  showTopPick = false,
  statusTabs,
  viewMode = "list",
}: {
  tasks: MatrixTask[];
  projectOptions: { id: string; label: string; color?: string | null }[];
  googleConnected?: boolean;
  // true на странице "План дня": список — только задачи конкретной даты, поэтому
  // "убрать из плана" должно сразу убрать карточку из вида, а не просто снять дату.
  planView?: boolean;
  // Пустое состояние разное по смыслу на разных экранах (план дня / задачи /
  // проект) — общее "Здесь пока пусто" не объясняет, что делать дальше.
  emptyMessage?: string;
  // Экран дня: выносит самую приоритетную активную задачу отдельным блоком
  // наверх — после её выполнения следующая по очереди сама займёт то же место,
  // без дополнительных действий.
  showTopPick?: boolean;
  // Вкладки Предстоит/Выполнено, по умолчанию Предстоит. Фильтрация
  // клиентская, на уже загруженных данных — переключение ощущается
  // мгновенно, без сервера.
  statusTabs?: boolean;
  // Список/Матрица — управляется страницей через ?layout=grid (та же ссылка,
  // что и другие переключатели видов в приложении), а не своим состоянием:
  // так переключатель можно вынести в верхний правый угол экрана, к остальным
  // ссылкам-переключателям, одинаково на всех страницах со списком задач.
  viewMode?: "list" | "grid";
}) {
  const [items, setItems] = useState(tasks);
  const [statusTab, setStatusTab] = useState<"upcoming" | "done">("upcoming");
  const [prevTasks, setPrevTasks] = useState(tasks);
  const [openId, setOpenId] = useState<string | null>(null);
  // Раскрытие длинного хвоста списка LATER — единственная группа, которую прячем
  // за "Показать ещё"; P0–P3 показываются целиком, одним стеком секций.
  const [laterExpanded, setLaterExpanded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ tasks: MatrixTask[]; timer: ReturnType<typeof setTimeout> } | null>(null);
  // Тост на уровне всего списка, а не строки — строка может в тот же момент
  // пропасть с текущей вкладки (см. statusTabs), тогда подсказка внутри неё
  // исчезла бы вместе с ней, не успев ничего объяснить. Хранит id только что
  // выполненных задач (одной или сразу нескольких через массовое действие),
  // чтобы "Отменить" в тосте реально знал, что возвращать.
  const [completedHint, setCompletedHint] = useState<string[] | null>(null);
  const completedHintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (completedHintTimer.current) clearTimeout(completedHintTimer.current); }, []);
  function triggerCompletedHint(ids: string[]) {
    setCompletedHint(ids);
    if (completedHintTimer.current) clearTimeout(completedHintTimer.current);
    completedHintTimer.current = setTimeout(() => setCompletedHint(null), 5000);
  }
  function undoCompletedHint() {
    const ids = completedHint;
    if (!ids) return;
    if (completedHintTimer.current) clearTimeout(completedHintTimer.current);
    setCompletedHint(null);
    ids.forEach((id) => handleRevert(id));
  }
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [partialTaskId, setPartialTaskId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const pendingDeleteRef = useRef(pendingDelete);
  useEffect(() => {
    pendingDeleteRef.current = pendingDelete;
  }, [pendingDelete]);

  // Server-компонент передаёт свежие данные при каждой навигации/revalidate —
  // синхронизируем локальную копию, иначе после мягкого перехода видно старое.
  if (tasks !== prevTasks) {
    setPrevTasks(tasks);
    setItems(tasks);
    setSelectedIds(new Set());
  }

  useEffect(() => {
    return () => {
      // Если ушли со страницы с "висящим" удалением — не теряем его молча.
      if (pendingDeleteRef.current) {
        clearTimeout(pendingDeleteRef.current.timer);
        pendingDeleteRef.current.tasks.forEach((t) => deleteTask(t.id));
      }
    };
  }, []);

  const visibleItems = statusTabs ? items.filter((t) => statusBucket(t.status) === statusTab) : items;

  const groups: Record<PriorityLabel, MatrixTask[]> = { P0: [], P1: [], P2: [], P3: [], LATER: [] };
  for (const t of visibleItems) groups[computePriority(t).label].push(t);
  for (const label of [...COLUMN_ORDER, "LATER" as const]) {
    groups[label].sort((a, b) => {
      const ra = a.manualRank ?? Infinity;
      const rb = b.manualRank ?? Infinity;
      if (ra !== rb) return ra - rb;
      return computePriority(b).score - computePriority(a).score;
    });
  }

  // "Сейчас" — первая ещё активная задача по уже посчитанному порядку (тому же,
  // что определяет группы выше). LATER сознательно не участвует — эти задачи не
  // должны попадать в фокус только потому, что больше ничего активного не осталось.
  // В "Матрице" задача остаётся в своём квадранте целиком — вынос "Сейчас"
  // отдельным блоком имеет смысл только в обычном списке.
  let topTask: MatrixTask | null = null;
  if (showTopPick && viewMode === "list") {
    for (const label of COLUMN_ORDER) {
      const found = groups[label].find((t) => t.status === "PLANNED" || t.status === undefined);
      if (found) { topTask = found; break; }
    }
  }

  function patch(id: string, p: Partial<MatrixTask>) {
    setItems((prev) => prev.map((t) => (t.id === id ? { ...t, ...p } : t)));
  }

  // Смена приоритета прямо в списке (не через карточку задачи) — тот же ручной override,
  // что и в TaskDrawer, только без похода в карточку.
  function handleManualPriority(id: string, label: PriorityLabel) {
    patch(id, { manualPriority: label, manualRank: null });
    startTransition(() => { setManualPriority(id, label); });
  }

  // Смена проекта прямо в списке (не через карточку задачи).
  function handleAssignProject(id: string, projectId: string | null) {
    const found = projectOptions.find((p) => p.id === projectId);
    const projectName = found ? found.label.replace(/^(— )+/, "") : null;
    patch(id, { projectId, projectName, projectColor: found?.color ?? null });
    startTransition(() => { assignTaskToProject(id, projectId); });
  }

  // Перетаскивание внутри группы и между группами. referenceId — задача, рядом с которой
  // бросили (null = в конец группы/на пустую группу), before — вставить до/после неё.
  function moveTask(targetGroup: PriorityLabel, referenceId: string | null, before: boolean, draggedId: string) {
    if (draggedId === referenceId) return;
    const currentTargetOrder = groups[targetGroup].filter((t) => t.id !== draggedId).map((t) => t.id);
    let insertIdx = currentTargetOrder.length;
    if (referenceId) {
      const refIdx = currentTargetOrder.indexOf(referenceId);
      if (refIdx !== -1) insertIdx = before ? refIdx : refIdx + 1;
    }
    const newOrder = [...currentTargetOrder];
    newOrder.splice(insertIdx, 0, draggedId);

    setItems((prev) =>
      prev.map((t) => {
        const idx = newOrder.indexOf(t.id);
        if (idx === -1) return t;
        return t.id === draggedId
          ? { ...t, manualPriority: targetGroup, manualRank: idx }
          : { ...t, manualRank: idx };
      })
    );
    startTransition(() => {
      reorderPriorityTask(draggedId, targetGroup, newOrder);
    });
  }

  function flushPendingDelete() {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    startTransition(() => { pending.tasks.forEach((t) => deleteTask(t.id)); });
    setPendingDelete(null);
  }

  // Общий soft-undo и для одиночного, и для массового удаления — раньше массовое
  // шло через блокирующий window.confirm(), единственный такой диалог во всём
  // приложении; теперь оба пути ведут себя одинаково: 6 секунд на "Отменить".
  function requestDelete(ids: string[]) {
    const tasks = items.filter((t) => ids.includes(t.id));
    if (tasks.length === 0) return;
    flushPendingDelete();
    setItems((prev) => prev.filter((t) => !ids.includes(t.id)));
    setOpenId(null);
    const timer = setTimeout(() => {
      startTransition(() => { tasks.forEach((t) => deleteTask(t.id)); });
      setPendingDelete(null);
    }, 6000);
    setPendingDelete({ tasks, timer });
  }

  function handleDeleteRequest(id: string) {
    requestDelete([id]);
  }

  function undoDelete() {
    const pending = pendingDeleteRef.current;
    if (!pending) return;
    clearTimeout(pending.timer);
    setItems((prev) => [...prev, ...pending.tasks]);
    setPendingDelete(null);
  }

  // В planView (План дня — все показанные задачи по определению одной даты) смена
  // даты уводит задачу с этой страницы. В общем списке (Все задачи/проект) она
  // остаётся видна — просто со сменившейся датой, которую подтянет ревалидация.
  function handleSchedule(id: string, target: "today" | "tomorrow") {
    if (planView) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    }
    startTransition(() => { scheduleTask(id, target); });
  }

  function handleScheduleDate(id: string, dateISO: string) {
    if (planView) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    }
    startTransition(() => { scheduleTaskToDate(id, dateISO); });
  }

  function handleUnschedule(id: string) {
    if (planView) {
      setItems((prev) => prev.filter((t) => t.id !== id));
      setOpenId(null);
    } else {
      setItems((prev) => prev.map((t) => (t.id === id ? { ...t, date: null } : t)));
    }
    startTransition(() => { unscheduleTask(id); });
  }

  function handleComplete(id: string) {
    // Не убираем из списка — задача остаётся видна в своей группе приоритета,
    // просто отмеченной. "План дня" — единый список на весь день, а не только
    // то, что ещё не сделано.
    patch(id, { status: "DONE" } as Partial<MatrixTask>);
    setOpenId(null);
    startTransition(() => { completeTask(id); });
    triggerCompletedHint([id]);
  }

  function handleRevert(id: string) {
    patch(id, { status: "PLANNED" } as Partial<MatrixTask>);
    startTransition(() => { revertTaskStatus(id); });
  }

  async function handleUndoMove(id: string): Promise<boolean> {
    const res = await undoMoveTask(id);
    if (res.ok) patch(id, { status: "PLANNED", movedToDate: null } as Partial<MatrixTask>);
    return res.ok;
  }

  // Продолжение создаётся на сервере с новым id, которого у нас ещё нет —
  // проще убрать исходную задачу из вида (как и при обычном "На завтра") и
  // дать следующей навигации/ревалидации показать новую запись там, где ей
  // положено быть, чем пытаться на клиенте угадывать её форму.
  async function handlePartialComplete(input: { doneNote: string | null; remainingNote: string | null; newDateISO: string | null }) {
    if (!partialTaskId) return;
    const res = await splitPartialTask(partialTaskId, {
      doneNote: input.doneNote,
      remainingNote: input.remainingNote,
      newDate: input.newDateISO ? parseDateInputValue(input.newDateISO) : null,
    });
    if (res.ok) {
      setItems((prev) => prev.filter((t) => t.id !== partialTaskId));
      setPartialTaskId(null);
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
  }

  // "Выбрать все" работает по текущей отфильтрованной вкладке (Предстоит/
  // Выполнено), а не только по видимому на экране куску LATER — это массовое
  // действие над данными, а не над тем, что дорисовано на странице.
  const allVisibleSelected = visibleItems.length > 0 && visibleItems.every((t) => selectedIds.has(t.id));
  function toggleSelectAll() {
    setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleItems.map((t) => t.id)));
  }

  function bulkComplete() {
    const ids = Array.from(selectedIds);
    setItems((prev) => prev.map((t) => (ids.includes(t.id) ? { ...t, status: "DONE" } : t)));
    startTransition(() => { ids.forEach((id) => completeTask(id)); });
    setSelectedIds(new Set());
    triggerCompletedHint(ids);
  }

  function bulkSchedule(target: "today" | "tomorrow") {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => handleSchedule(id, target));
    setSelectedIds(new Set());
  }

  function bulkScheduleDate(dateISO: string) {
    const ids = Array.from(selectedIds);
    ids.forEach((id) => handleScheduleDate(id, dateISO));
    setSelectedIds(new Set());
  }

  function bulkDelete() {
    const ids = Array.from(selectedIds);
    requestDelete(ids);
    setSelectedIds(new Set());
  }

  const openTask = items.find((t) => t.id === openId) ?? null;
  const drawerTask: DrawerTask | null = openTask ? { ...openTask } : null;

  // Массовые действия должны быть осмысленны для того, что реально выделено —
  // иначе "Сегодня"/"Завтра" на уже выполненной задаче молча сняли бы отметку
  // "выполнено" и перенесли её, а "Выполнено" на уже готовой ничего не меняет.
  const selectedTasks = items.filter((t) => selectedIds.has(t.id));
  const canBulkComplete = selectedTasks.some((t) => t.status !== "DONE");
  const canBulkReschedule = selectedTasks.some((t) => t.status !== "DONE" && t.status !== "MOVED");
  // "Сегодня" бессмысленна, если у всех выбранных и так уже сегодняшняя дата
  // (типичный случай — выделение в "Плане дня" за сегодня).
  const canBulkToday = selectedTasks.some((t) => !t.date || !sameDate(t.date, todayDate()));

  const laterVisible = laterExpanded ? groups.LATER : groups.LATER.slice(0, GROUP_PREVIEW);

  // Общий рендер строки — переиспользуется и для "Сейчас" наверху, и для обычных
  // групп ниже, чтобы вся логика строки (клики, drag, быстрые правки) жила в одном месте.
  function renderRow(t: MatrixTask, label: PriorityLabel, hero = false, compact = false) {
    return (
      <TaskRow
        key={t.id}
        task={t}
        color={label}
        hero={hero}
        compact={compact}
        onOpen={() => setOpenId(t.id)}
        onDropBefore={(draggedId, before) => moveTask(label, t.id, before, draggedId)}
        onDelete={() => handleDeleteRequest(t.id)}
        onUnschedule={() => handleUnschedule(t.id)}
        onComplete={() => handleComplete(t.id)}
        onRevert={() => handleRevert(t.id)}
        onUndoMove={() => handleUndoMove(t.id)}
        onManualPriority={(l) => handleManualPriority(t.id, l)}
        onAssignProject={(id) => handleAssignProject(t.id, id)}
        projectOptions={projectOptions}
        onScheduleToday={() => handleSchedule(t.id, "today")}
        onScheduleTomorrow={() => handleSchedule(t.id, "tomorrow")}
        onScheduleDate={(dateISO) => handleScheduleDate(t.id, dateISO)}
        selected={selectedIds.has(t.id)}
        selectionActive={selectedIds.size > 0}
        onToggleSelect={() => toggleSelect(t.id)}
        onPartialComplete={() => setPartialTaskId(t.id)}
      />
    );
  }

  // Квадрант матрицы — та же секция группы, что и в списке (та же группа задач,
  // тот же moveTask/renderRow), только оформлена как отдельная плашка с белым
  // "лотком" карточек внутри и своей зоной вставки (вся площадь, а не только
  // список — пустой квадрант тоже принимает drop).
  function renderQuadrant(label: "P0" | "P1" | "P2" | "P3") {
    const list = groups[label];
    return (
      <div key={label} className={`rounded-2xl ring-1 p-2.5 flex flex-col ${QUADRANT_CLASS[label]}`}>
        <div className="flex items-center gap-2 mb-2 px-1 pt-0.5">
          <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[label]}`} />
          <p className="text-[13px] font-semibold text-neutral-800 tracking-[-0.01em]">{PRIORITY_LABEL_TEXT[label]}</p>
          <span className="ml-auto text-[11px] font-semibold text-neutral-500 tabular-nums bg-white/70 rounded-md px-1.5 py-0.5">
            {list.length}
          </span>
        </div>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const draggedId = e.dataTransfer.getData("text/plain");
            if (draggedId) moveTask(label, null, false, draggedId);
          }}
          className="bg-white rounded-xl ring-1 ring-neutral-200 shadow-xs divide-y divide-neutral-100 flex-1 min-h-[64px] overflow-hidden"
        >
          {list.length === 0 ? (
            // Пунктир вместо простого текста — зона приёма видна как зона,
            // а не как подпись, которая случайно оказалась в пустом блоке.
            <p className="m-2 rounded-lg border border-dashed border-neutral-300 text-[11px] text-neutral-400 text-center py-5 px-2">
              Перетащите задачу сюда
            </p>
          ) : (
            list.map((t) => renderRow(t, label, false, true))
          )}
        </div>
        <Link
          href={`/tasks/new?priority=${label}`}
          className="inline-flex items-center gap-1 self-start text-[11px] text-neutral-500 hover:text-neutral-900 mt-2 px-1 py-0.5 rounded-md transition-colors"
        >
          <IconPlus size={12} className="shrink-0" />
          Добавить задачу
        </Link>
      </div>
    );
  }

  // Пустое состояние — не строчка серым в пустоте, а явная пунктирная рамка:
  // видно, что это место для задач, а не что экран не догрузился.
  const emptyState = (message: string) => (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50/60 px-4 py-10 text-center">
      <p className="text-sm text-neutral-500 max-w-sm mx-auto leading-relaxed">{message}</p>
    </div>
  );

  if (!statusTabs && items.length === 0) {
    return emptyState(emptyMessage);
  }

  return (
    <div className="space-y-7">
      {(statusTabs || visibleItems.length > 0) && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {statusTabs ? (
            <div className="segmented">
              <button
                type="button"
                onClick={() => setStatusTab("upcoming")}
                className="segment"
                data-active={statusTab === "upcoming"}
              >
                Предстоит выполнить
              </button>
              <button
                type="button"
                onClick={() => setStatusTab("done")}
                className="segment"
                data-active={statusTab === "done"}
              >
                Выполнено
              </button>
            </div>
          ) : (
            <span />
          )}
          {visibleItems.length > 0 && (
            <label className="flex items-center gap-2 text-xs text-neutral-500 hover:text-neutral-800 transition-colors">
              <input type="checkbox" checked={allVisibleSelected} onChange={toggleSelectAll} />
              Выбрать все
            </label>
          )}
        </div>
      )}

      {visibleItems.length === 0 ? (
        emptyState(statusTab === "done" ? "Пока ничего не выполнено." : emptyMessage)
      ) : (
        <>
          {topTask && (() => {
            const topLabel = computePriority(topTask).label;
            return (
              <div>
                <p className="text-[10px] font-semibold text-neutral-500 uppercase tracking-[0.1em] px-1 mb-2">
                  Сейчас
                </p>
                {/* Единственная задача, на которую нужно смотреть прямо сейчас,
                    поэтому она — единственная приподнятая поверхность на экране:
                    мягкий градиент в цвет приоритета, кольцо вместо рамки,
                    тень. Остальной список остаётся плоским. */}
                <div className={`ring-1 rounded-2xl overflow-hidden shadow-sm ${HERO_RING_CLASS[topLabel]}`}>
                  {renderRow(topTask, topLabel, true)}
                </div>
              </div>
            );
          })()}

          {viewMode === "grid" ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COLUMN_ORDER.map((label) => renderQuadrant(label))}
            </div>
          ) : (
            COLUMN_ORDER.filter((label) => groups[label].some((t) => t.id !== topTask?.id)).map((label) => (
              <div key={label}>
                {/* Заголовок группы: название слева, счётчик прижат вправо
                    и выровнен с правым краем списка — при беглом просмотре
                    видно распределение нагрузки по приоритетам одним столбцом
                    цифр, а не россыпью «· 3» посреди строки. */}
                <div className="flex items-center gap-2 px-1 mb-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS[label]}`} />
                  <p className="text-[11px] font-semibold text-neutral-600 uppercase tracking-[0.06em]">
                    {PRIORITY_LABEL_TEXT[label]}
                  </p>
                  <span className="flex-1 h-px bg-neutral-200" />
                  <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">
                    {groups[label].filter((t) => t.id !== topTask?.id).length}
                  </span>
                </div>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const draggedId = e.dataTransfer.getData("text/plain");
                    if (draggedId) moveTask(label, null, false, draggedId);
                  }}
                  className="divide-y divide-neutral-100"
                >
                  {groups[label].filter((t) => t.id !== topTask?.id).map((t) => renderRow(t, label))}
                </div>
              </div>
            ))
          )}

          {groups.LATER.length > 0 && (
            <div>
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_CLASS.LATER}`} />
                <p className="text-[11px] font-semibold text-neutral-500 uppercase tracking-[0.06em]">
                  {PRIORITY_LABEL_TEXT.LATER}
                </p>
                <span className="flex-1 h-px bg-neutral-200" />
                <span className="text-[11px] font-semibold text-neutral-400 tabular-nums">{groups.LATER.length}</span>
              </div>
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const draggedId = e.dataTransfer.getData("text/plain");
                  if (draggedId) moveTask("LATER", null, false, draggedId);
                }}
                className="divide-y divide-neutral-100"
              >
                {laterVisible.map((t) => renderRow(t, "LATER"))}
              </div>
              {groups.LATER.length > GROUP_PREVIEW && (
                <button
                  type="button"
                  onClick={() => setLaterExpanded((v) => !v)}
                  className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 px-1 mt-2 py-0.5 rounded-md transition-colors"
                >
                  {laterExpanded ? (
                    <>
                      <IconChevronDown size={12} className="rotate-180 shrink-0" />
                      Свернуть
                    </>
                  ) : (
                    <>
                      <IconChevronDown size={12} className="shrink-0" />
                      Показать ещё {groups.LATER.length - GROUP_PREVIEW}
                    </>
                  )}
                </button>
              )}
            </div>
          )}
        </>
      )}

      <TaskDrawer
        task={drawerTask}
        projectOptions={projectOptions}
        googleConnected={googleConnected}
        onClose={() => setOpenId(null)}
        onChangeText={(text) => {
          if (!openId) return;
          patch(openId, { text });
          startTransition(() => { updateTaskFields(openId, { text }); });
        }}
        onChangeProject={(projectId) => {
          if (!openId) return;
          const found = projectOptions.find((p) => p.id === projectId);
          patch(openId, { projectId, projectName: found?.label ?? null, projectColor: found?.color ?? null });
          startTransition(() => { updateTaskFields(openId, { projectId }); });
        }}
        onChangeField={(fieldPatch) => {
          if (!openId) return;
          patch(openId, fieldPatch as Partial<MatrixTask>);
          startTransition(() => { updateTaskFields(openId, fieldPatch); });
        }}
        onManualPriority={(label) => {
          if (!openId) return;
          patch(openId, { manualPriority: label, manualRank: null });
          startTransition(() => { setManualPriority(openId, label); });
        }}
        onDelete={() => openId && handleDeleteRequest(openId)}
        onScheduleToday={() => openId && handleSchedule(openId, "today")}
        onScheduleTomorrow={() => openId && handleSchedule(openId, "tomorrow")}
        onScheduleDate={(dateISO) => openId && handleScheduleDate(openId, dateISO)}
        onAddToCalendar={async (date, startTime, durationMinutes) => {
          if (!openId) return { ok: false, error: "Нет открытой задачи." };
          const res = await addTaskToGoogleCalendar(openId, { date, startTime, durationMinutes });
          if (res.ok) {
            patch(openId, { googleEventUrl: res.eventUrl });
            return { ok: true };
          }
          return { ok: false, error: res.error };
        }}
        onRemoveFromCalendar={() => {
          if (!openId) return;
          patch(openId, { googleEventId: null, googleEventUrl: null });
          startTransition(() => { removeTaskFromGoogleCalendar(openId); });
        }}
        onAddSubtask={async (text) => {
          if (!openId) return;
          const created = await addSubtask(openId, text);
          if (!created) return;
          const current = items.find((t) => t.id === openId);
          patch(openId, {
            subtasks: [...(current?.subtasks ?? []), { id: created.id, text: created.text, done: created.done }],
          } as Partial<MatrixTask>);
        }}
        onToggleSubtask={(subtaskId, done) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, done } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { toggleSubtask(subtaskId, done); });
        }}
        onRenameSubtask={(subtaskId, text) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, text } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { renameSubtask(subtaskId, text); });
        }}
        onDeleteSubtask={(subtaskId) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          patch(openId, {
            subtasks: (current.subtasks ?? []).filter((s) => s.id !== subtaskId),
          } as Partial<MatrixTask>);
          startTransition(() => { deleteSubtask(subtaskId); });
        }}
        onScheduleSubtask={(subtaskId, dateISO) => {
          if (!openId) return;
          const current = items.find((t) => t.id === openId);
          if (!current) return;
          const date = dateISO ? parseDateInputValue(dateISO) : null;
          patch(openId, {
            subtasks: (current.subtasks ?? []).map((s) => (s.id === subtaskId ? { ...s, date } : s)),
          } as Partial<MatrixTask>);
          startTransition(() => { scheduleSubtask(subtaskId, dateISO); });
        }}
      />

      {selectedIds.size > 0 && (
        <div
          className={`toast fixed left-1/2 z-50 flex-wrap justify-center max-w-[calc(100vw-2rem)] transition-[bottom] duration-300 ${
            pendingDelete ? "bottom-20" : "bottom-5"
          }`}
        >
          <span className="pr-1 tabular-nums font-medium">
            {selectedIds.size} {tasksWord(selectedIds.size)}
          </span>
          <span className="w-px h-4 bg-white/15" aria-hidden />
          {canBulkComplete && (
            <button type="button" onClick={bulkComplete} className="toast-btn">
              Выполнено
            </button>
          )}
          {canBulkReschedule && (
            <BulkMovePicker
              showToday={canBulkToday}
              onToday={() => bulkSchedule("today")}
              onTomorrow={() => bulkSchedule("tomorrow")}
              onMonday={() => bulkScheduleDate(toDateInputValue(nextMonday(todayDate())))}
              onDate={(dateISO) => bulkScheduleDate(dateISO)}
            />
          )}
          <button
            type="button"
            onClick={bulkDelete}
            className="toast-btn hover:!bg-red-500/80"
          >
            Удалить
          </button>
          <button
            type="button"
            onClick={clearSelection}
            className="px-2.5 py-1 rounded-full text-white/60 hover:text-white hover:bg-white/10 transition-colors"
          >
            Отмена
          </button>
        </div>
      )}

      {pendingDelete && (
        <div className="toast fixed bottom-5 left-1/2 z-50">
          <span>
            {pendingDelete.tasks.length === 1
              ? "Задача удалена"
              : `${pendingDelete.tasks.length} ${tasksWord(pendingDelete.tasks.length)} удалены`}
          </span>
          <button type="button" onClick={undoDelete} className="toast-btn ml-1">
            Отменить
          </button>
        </div>
      )}

      {completedHint && (
        <div
          className={`toast fixed left-1/2 z-50 transition-[bottom] duration-300 ${
            pendingDelete ? "bottom-20" : "bottom-5"
          }`}
        >
          <IconCheck size={15} className="text-emerald-400 shrink-0" />
          <span>
            {completedHint.length === 1
              ? `Выполнено${statusTabs ? " · ушла в «Выполнено»" : ""}`
              : `Выполнено: ${completedHint.length} ${tasksWord(completedHint.length)}`}
          </span>
          <button type="button" onClick={undoCompletedHint} className="toast-btn ml-1">
            Отменить
          </button>
        </div>
      )}

      {partialTaskId && (() => {
        const partialTask = items.find((t) => t.id === partialTaskId);
        if (!partialTask) return null;
        return (
          <PartialCompleteDialog
            taskText={partialTask.text}
            onClose={() => setPartialTaskId(null)}
            onSubmit={handlePartialComplete}
          />
        );
      })()}
    </div>
  );
}
