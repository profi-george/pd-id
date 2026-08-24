"use client";

import { useState } from "react";
import {
  computePriority,
  formatEffort,
  PRIORITY_LABEL_TEXT,
  PRIORITY_LABEL_HINT,
  type PriorityLabel,
  type TaskEvaluation,
} from "@/lib/priorityEngine";
import { CRITERIA_INFO, EFFORT_INFO, type CriterionKey } from "@/lib/criteriaInfo";
import CriterionInfo from "@/components/CriterionInfo";

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
};

function toDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const LABELS: PriorityLabel[] = ["P0", "P1", "P2", "P3", "LATER"];
const SCALE = [1, 2, 3, 4, 5];

const CRITERION_FIELDS: { key: CriterionKey; aiKey: keyof DrawerTask; reasonKey: keyof DrawerTask }[] = [
  { key: "value", aiKey: "aiValue", reasonKey: "aiReasoningValue" },
  { key: "costOfDelay", aiKey: "aiCostOfDelay", reasonKey: "aiReasoningCostOfDelay" },
  { key: "urgency", aiKey: "aiUrgency", reasonKey: "aiReasoningUrgency" },
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
  onAddToCalendar?: (date: string, startTime: string, durationMinutes: number) => Promise<{ ok: boolean; error?: string }>;
  onRemoveFromCalendar?: () => void;
}) {
  const [calDate, setCalDate] = useState("");
  const [calTime, setCalTime] = useState("09:00");
  const [calSaving, setCalSaving] = useState(false);
  const [calError, setCalError] = useState<string | null>(null);

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
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 bottom-0 w-full max-w-md bg-white shadow-xl z-50 overflow-y-auto p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <textarea
            value={task.text}
            onChange={(e) => onChangeText(e.target.value)}
            rows={2}
            className="flex-1 text-base font-medium border-none outline-none resize-none"
          />
          <button onClick={onClose} className="text-neutral-400 hover:text-neutral-800 text-xl leading-none">
            ×
          </button>
        </div>

        <div>
          <label className="block text-xs text-neutral-500 mb-1">Проект</label>
          <select
            value={task.projectId ?? ""}
            onChange={(e) => onChangeProject(e.target.value || null)}
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
                onClick={() => onManualPriority(l === aiLabel && !isManual ? null : l)}
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
          {isManual && (
            <p className="text-xs text-neutral-500 mt-1">
              Изменено вручную (AI предлагал «{PRIORITY_LABEL_TEXT[aiLabel]}»).{" "}
              <button type="button" onClick={() => onManualPriority(null)} className="underline">
                Вернуть оценку AI
              </button>
            </p>
          )}
        </div>

        <div className="bg-neutral-50 border border-neutral-200 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-neutral-600">Почему такой приоритет?</p>
          {task.primaryReason && (
            <div>
              <p className="text-[11px] text-neutral-400 uppercase tracking-wide">Главная причина</p>
              <p className="text-sm italic text-ink-600 border-l-2 border-ink-500/30 pl-2">
                {task.primaryReason}
              </p>
            </div>
          )}
          {task.riskText && (
            <p className="text-xs italic text-neutral-500 border-l-2 border-neutral-300 pl-2">
              Риск отложить: {task.riskText}
            </p>
          )}

          <div className="space-y-1.5 pt-1">
            {CRITERION_FIELDS.map(({ key, aiKey, reasonKey }) => {
              const info = CRITERIA_INFO[key];
              const current = task[key];
              const aiOriginal = task[aiKey] as number | null | undefined;
              const changed = aiOriginal != null && aiOriginal !== current;
              return (
                <div key={key} className="text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500 flex items-center gap-1">
                      {info.title}
                      <CriterionInfo
                        title={info.title}
                        definition={info.definition}
                        scale={info.scale}
                        reasoning={task[reasonKey] as string | null | undefined}
                      />
                    </span>
                    <select
                      value={current}
                      onChange={(e) => onChangeField({ [key]: Number(e.target.value) } as Partial<TaskEvaluation>)}
                      className="border border-neutral-300 rounded px-1 py-0.5"
                    >
                      {SCALE.map((n) => <option key={n} value={n}>{n}/5</option>)}
                    </select>
                  </div>
                  {changed && (
                    <p className="text-[11px] text-neutral-400 text-right">
                      Изменено вручную (AI: {aiOriginal}/5)
                    </p>
                  )}
                </div>
              );
            })}

            <div className="text-xs">
              <div className="flex items-center justify-between">
                <span className="text-neutral-500 flex items-center gap-1">
                  {EFFORT_INFO.title}
                  <CriterionInfo
                    title={EFFORT_INFO.title}
                    definition={EFFORT_INFO.definition}
                    reasoning={task.aiReasoningEffort}
                  />
                </span>
                <input
                  type="number"
                  min={5}
                  step={5}
                  value={task.effortMinutes}
                  onChange={(e) => onChangeField({ effortMinutes: Number(e.target.value) })}
                  className="w-20 border border-neutral-300 rounded px-1 py-0.5 text-right"
                />
              </div>
              <p className="text-[11px] text-neutral-400 text-right">
                {effortChanged
                  ? `Изменено вручную (AI: ${formatEffort(effortAi!)})`
                  : `~${formatEffort(task.effortMinutes)} · ${effortSource}`}
              </p>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-neutral-500">Дедлайн</span>
              <input
                type="date"
                value={task.deadline ? toDateInput(task.deadline) : ""}
                onChange={(e) => onChangeField({ deadline: e.target.value ? new Date(e.target.value) : null })}
                className="border border-neutral-300 rounded px-1 py-0.5"
              />
            </div>
          </div>

          <p className="text-xs text-neutral-400 pt-1 border-t border-neutral-100">
            Уверенность AI · {Math.round(task.confidence * 100)}%
          </p>
        </div>

        {(onScheduleToday || onScheduleTomorrow) && (
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

        <button
          onClick={onDelete}
          className="text-xs text-neutral-400 hover:text-red-600 hover:underline"
        >
          Удалить задачу
        </button>
      </div>
    </>
  );
}
