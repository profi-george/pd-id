"use client";

import { useEffect, useRef, useState } from "react";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  PRIORITY_LABEL_HINT,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import { CRITERIA_INFO, type CriterionKey } from "@/lib/criteriaInfo";
import CriterionInfo from "@/components/CriterionInfo";
import { recalculatePriority } from "@/app/(app)/actions";

export type DrawerTask = TaskEvaluation & {
  id: string;
  text: string;
  projectId: string | null;
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
  confidenceReason?: string | null;
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const LABELS: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];

const CRITERION_FIELDS: { key: CriterionKey; aiKey: keyof DrawerTask; reasonKey: keyof DrawerTask }[] = [
  { key: "value", aiKey: "aiValue", reasonKey: "aiReasoningValue" },
  { key: "costOfDelay", aiKey: "aiCostOfDelay", reasonKey: "aiReasoningCostOfDelay" },
  { key: "timeSensitivity", aiKey: "aiTimeSensitivity", reasonKey: "aiReasoningTimeSensitivity" },
];

export default function TaskDrawer({
  task,
  projectOptions,
  googleConnected,
  onClose,
  onChangeText,
  onChangeProject,
  onChangeField,
  onManualPriority,
  onDelete,
  onScheduleToday,
  onScheduleTomorrow,
  onScheduleDate,
  onAddToCalendar,
  onRemoveFromCalendar,
}: {
  task: DrawerTask | null;
  projectOptions: { id: string; label: string }[];
  googleConnected?: boolean;
  onClose: () => void;
  onChangeText: (text: string) => void;
  onChangeProject: (projectId: string | null) => void;
  onChangeField: (patch: Partial<TaskEvaluation>) => void;
  onManualPriority: (label: PriorityLabel | null) => void;
  onDelete: () => void;
  onScheduleToday?: () => void;
  onScheduleTomorrow?: () => void;
  onScheduleDate?: (dateISO: string) => void;
  onAddToCalendar?: (date: string, startTime: string, durationMinutes: number) => Promise<{ ok: boolean; error?: string }>;
  onRemoveFromCalendar?: () => void;
}) {
  const [scheduleDate, setScheduleDate] = useState("");
  const [calDate, setCalDate] = useState("");
  const [calTime, setCalTime] = useState("09:00");
  const [calSaving, setCalSaving] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [prevTaskId, setPrevTaskId] = useState<string | null>(task?.id ?? null);
  const [saved, setSaved] = useState(false);
  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [editingCriteria, setEditingCriteria] = useState(false);
  const [draft, setDraft] = useState<{ value: number; costOfDelay: number; timeSensitivity: number } | null>(null);
  const [recalcLoading, setRecalcLoading] = useState(false);
  const [recalcError, setRecalcError] = useState<string | null>(null);

  if ((task?.id ?? null) !== prevTaskId) {
    setPrevTaskId(task?.id ?? null);
    setConfirmingDelete(false);
    setShowExplanation(false);
    setEditingCriteria(false);
    setDraft(null);
    setRecalcError(null);
  }

  useEffect(() => {
    return () => { if (savedTimer.current) clearTimeout(savedTimer.current); };
  }, []);

  function flashSaved() {
    setSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setSaved(false), 1500);
  }

  function handleChangeField(patch: Partial<TaskEvaluation>) {
    onChangeField(patch);
    flashSaved();
  }

  function handleManualPriority(l: PriorityLabel | null) {
    onManualPriority(l);
    flashSaved();
  }

  function handleChangeProject(projectId: string | null) {
    onChangeProject(projectId);
    flashSaved();
  }

  function openCriteriaEditor() {
    if (!task) return;
    setDraft({ value: task.value, costOfDelay: task.costOfDelay, timeSensitivity: task.timeSensitivity });
    setEditingCriteria(true);
    setRecalcError(null);
  }

  async function handleRecalculate() {
    if (!task || !draft) return;
    setRecalcLoading(true);
    setRecalcError(null);
    const res = await recalculatePriority(task.id, { ...draft, effortMinutes: task.effortMinutes });
    setRecalcLoading(false);
    if (!res.ok) {
      setRecalcError(res.error);
      return;
    }
    onChangeField({ ...draft, primaryReason: res.primaryReason } as Partial<TaskEvaluation>);
    flashSaved();
    setEditingCriteria(false);
    setDraft(null);
  }

  if (!task) return null;
  const { label, aiLabel, isManual } = computePriority(task);

  async function handleAddToCalendar() {
    if (!onAddToCalendar || !task) return;
    const date = calDate || (task.deadline ? toDateInput(task.deadline) : toDateInput(new Date()));
    setCalSaving(true);
    setCalError(null);
    const res = await onAddToCalendar(date, calTime, task.effortMinutes);
    setCalSaving(false);
    if (!res.ok) setCalError(res.error ?? "Не удалось добавить событие.");
  }

  const effortAi = task.aiEffortMinutes ?? null;
  const effortChanged = effortAi !== null && effortAi !== task.effortMinutes;
  const effortSource = effortAi === null ? "введено вами" : effortChanged ? null : "оценка AI";

  return (
    <div
      className="fixed inset-0 bg-black/30 z-40 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-xl shadow-xl w-full sm:max-w-2xl min-h-full sm:min-h-0 sm:my-8 p-4 sm:p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <textarea
            value={task.text}
            onChange={(e) => onChangeText(e.target.value)}
            rows={2}
            className="flex-1 text-lg font-medium border-none outline-none resize-none"
          />
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800 text-xl leading-none shrink-0">
            ×
          </button>
        </div>

        <p
          className={`text-[11px] text-emerald-600 h-4 transition-opacity ${saved ? "opacity-100" : "opacity-0"}`}
          aria-live="polite"
        >
          ✓ Сохранено
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Проект</label>
            <select
              value={task.projectId ?? ""}
              onChange={(e) => handleChangeProject(e.target.value || null)}
              className="w-full border border-neutral-300 rounded px-2 py-1.5 text-sm"
            >
              <option value="">Без проекта</option>
              {projectOptions.map((p) => (
                <option key={p.id} value={p.id}>{p.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-neutral-500 mb-1">Приоритет</label>
            <div className="flex flex-wrap gap-1.5">
              {LABELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => handleManualPriority(l === aiLabel && !isManual ? null : l)}
                  className={`text-xs px-2 py-1 rounded border ${
                    label === l
                      ? "bg-neutral-800 text-white border-neutral-800"
                      : "border-neutral-300 hover:bg-neutral-50"
                  }`}
                  title={PRIORITY_LABEL_HINT[l]}
                >
                  {PRIORITY_LABEL_TEXT[l]}
                </button>
              ))}
            </div>
          </div>
        </div>
        {isManual && (
          <p className="text-xs text-neutral-500 -mt-2">
            Изменено вручную (AI предлагал «{PRIORITY_LABEL_TEXT[aiLabel]}»).{" "}
            <button type="button" onClick={() => handleManualPriority(null)} className="underline">
              Вернуть оценку AI
            </button>
          </p>
        )}

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="block text-xs text-neutral-500 mb-1">Время выполнения</span>
            <input
              type="number"
              min={5}
              step={5}
              value={task.effortMinutes}
              onChange={(e) => handleChangeField({ effortMinutes: Number(e.target.value) })}
              className="w-full max-w-[7rem] border border-neutral-300 rounded px-2 py-1"
            />
            <span className="block text-xs text-neutral-400 mt-1">
              {effortChanged ? `AI: ${formatEffort(effortAi!)}` : effortSource === "введено вами" ? "введено вами" : "оценка AI"}
            </span>
          </div>
          <div>
            <span className="block text-xs text-neutral-500 mb-1">Дедлайн</span>
            <input
              type="date"
              value={task.deadline ? toDateInput(task.deadline) : ""}
              onChange={(e) => handleChangeField({ deadline: e.target.value ? new Date(e.target.value) : null })}
              className="w-full max-w-[10rem] border border-neutral-300 rounded px-2 py-1"
            />
          </div>
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-neutral-600">Почему такой приоритет?</p>
            <button
              type="button"
              onClick={() => (editingCriteria ? setEditingCriteria(false) : openCriteriaEditor())}
              className="text-neutral-400 hover:text-ink-600 text-sm shrink-0"
              title="Настроить оценку вручную"
              aria-label="Настроить оценку вручную"
            >
              ✎
            </button>
          </div>

          {task.primaryReason && (
            <button
              type="button"
              onClick={() => setShowExplanation((v) => !v)}
              className="text-sm italic text-ink-600 border-l-2 border-ink-500/30 pl-2 text-left hover:text-ink-500"
            >
              {task.primaryReason}
            </button>
          )}
          {task.riskText && (
            <p className="text-xs italic text-neutral-500 border-l-2 border-neutral-300 pl-2">
              Риск отложить: {task.riskText}
            </p>
          )}

          {showExplanation && !editingCriteria && (
            <div className="space-y-1.5 pt-1 border-t border-neutral-100">
              <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Как AI оценил задачу</p>
              {CRITERION_FIELDS.map(({ key, reasonKey }) => {
                const reasoning = task[reasonKey] as string | null | undefined;
                if (!reasoning) return null;
                return (
                  <div key={key} className="text-xs">
                    <span className="text-neutral-500 font-medium">{CRITERIA_INFO[key].title}: </span>
                    <span className="text-neutral-600">{reasoning}</span>
                  </div>
                );
              })}
            </div>
          )}

          {editingCriteria && draft && (
            <div className="space-y-3 pt-2 border-t border-neutral-100">
              <p className="text-xs text-neutral-500">Настроить оценку</p>
              {CRITERION_FIELDS.map(({ key }) => (
                <div key={key} className="space-y-0.5">
                  <div className="flex items-center justify-between text-xs text-neutral-600">
                    <span className="flex items-center gap-1">
                      {CRITERIA_INFO[key].title}
                      <CriterionInfo
                        title={CRITERIA_INFO[key].title}
                        definition={CRITERIA_INFO[key].definition}
                        scale={CRITERIA_INFO[key].scale}
                      />
                    </span>
                    <span className="tabular-nums">{draft[key]}/5</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: Number(e.target.value) })}
                    className="w-full accent-ink-500"
                  />
                </div>
              ))}
              <p className="text-xs text-neutral-400">
                Время выполнения: ~{formatEffort(task.effortMinutes)} (не меняется здесь)
              </p>
              {recalcError && <p className="text-xs text-red-600">{recalcError}</p>}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => { setEditingCriteria(false); setDraft(null); }}
                  className="flex-1 text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50"
                >
                  Отмена
                </button>
                <button
                  type="button"
                  onClick={handleRecalculate}
                  disabled={recalcLoading}
                  className="flex-1 text-xs px-2 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50"
                >
                  {recalcLoading ? "Пересчитываю…" : "Пересчитать"}
                </button>
              </div>
            </div>
          )}

          <p className="text-xs text-neutral-400 pt-1 border-t border-neutral-100">
            Уверенность AI: {Math.round(task.confidence * 100)}%
            {task.confidence < 0.75 && task.confidenceReason && (
              <span> — {task.confidenceReason}</span>
            )}
          </p>
        </div>

        {(onScheduleToday || onScheduleTomorrow || onScheduleDate) && (
          <div className="space-y-1.5">
            <div className="flex gap-2">
              {onScheduleToday && (
                <button
                  onClick={onScheduleToday}
                  className="text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 flex-1"
                >
                  На сегодня
                </button>
              )}
              {onScheduleTomorrow && (
                <button
                  onClick={onScheduleTomorrow}
                  className="text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 flex-1"
                >
                  На завтра
                </button>
              )}
            </div>
            {onScheduleDate && (
              <div className="flex gap-2">
                <input
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => setScheduleDate(e.target.value)}
                  className="flex-1 border border-neutral-300 rounded px-2 py-1.5 text-xs"
                />
                <button
                  onClick={() => scheduleDate && onScheduleDate(scheduleDate)}
                  disabled={!scheduleDate}
                  className="text-xs px-2 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 disabled:opacity-40 shrink-0"
                >
                  На дату
                </button>
              </div>
            )}
          </div>
        )}

        {googleConnected && (
          <div className="border border-neutral-200 rounded-lg p-3 space-y-2">
            <p className="text-xs font-medium text-neutral-600">Google-календарь</p>
            {task.googleEventUrl ? (
              <div className="flex items-center justify-between gap-2">
                <a
                  href={task.googleEventUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-ink-600 underline"
                >
                  Открыть событие
                </a>
                <button
                  type="button"
                  onClick={onRemoveFromCalendar}
                  className="text-xs text-red-600 hover:underline shrink-0"
                >
                  Убрать
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={calDate || (task.deadline ? toDateInput(task.deadline) : "")}
                  onChange={(e) => setCalDate(e.target.value)}
                  className="border border-neutral-300 rounded px-1.5 py-1 text-xs flex-1"
                />
                <input
                  type="time"
                  value={calTime}
                  onChange={(e) => setCalTime(e.target.value)}
                  className="border border-neutral-300 rounded px-1.5 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={handleAddToCalendar}
                  disabled={calSaving}
                  className="text-xs px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-50 shrink-0"
                >
                  {calSaving ? "…" : "Добавить"}
                </button>
              </div>
            )}
            {calError && <p className="text-xs text-red-600">{calError}</p>}
          </div>
        )}

        {confirmingDelete ? (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-neutral-600">Удалить задачу?</span>
            <button
              onClick={() => setConfirmingDelete(false)}
              className="px-2 py-1 rounded border border-neutral-300 hover:bg-neutral-50"
            >
              Отмена
            </button>
            <button
              onClick={onDelete}
              className="px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
            >
              Удалить
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-neutral-400 hover:text-red-600 hover:underline"
          >
            🗑 Удалить задачу
          </button>
        )}
      </div>
    </div>
  );
}
