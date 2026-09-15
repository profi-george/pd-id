"use client";

import { useState } from "react";
import PriorityTag from "@/components/PriorityTag";
import type { TaskEvaluation } from "@/lib/priorityEngine";
import {
  IconArrowRight,
  IconBookOpen,
  IconCheck,
  IconChevronDown,
  IconHalfCircle,
  IconPencil,
} from "@/components/icons";

const SCALE_10 = Array.from({ length: 11 }, (_, i) => i);

export type EveningTask = TaskEvaluation & {
  id: string;
  text: string;
  projectName: string | null;
  status?: string;
  score?: number | null;
  scoreReasoning?: string | null;
  whySucceeded?: string | null;
  whyFailed?: string | null;
};

type Outcome = "done" | "partial" | "not_done";

function outcomeFromStatus(status?: string): Outcome {
  if (status === "DONE") return "done";
  if (status === "PARTIAL") return "partial";
  return "not_done";
}

// Записываем в дневник ведения рекламных правок именно причину исхода, а не
// исходную формулировку задачи — "почему не получилось"/"что успели" уже
// готовый текст для строки журнала, вводить его туда заново не нужно.
const DNEVNIK_URL = "https://dnevnik-gold.vercel.app";

export default function EveningTaskRow({ task }: { task: EveningTask }) {
  const [outcome, setOutcome] = useState<Outcome>(outcomeFromStatus(task.status));
  // Сворачивание разобранной задачи — при 5+ задачах форма иначе ощущается
  // одной длинной анкетой; по мере разбора список визуально укорачивается.
  // Поля скрываются через CSS (hidden), а не размонтируются — значения
  // остаются в DOM и всё равно уходят в submit формы.
  const [collapsed, setCollapsed] = useState(false);
  // Оценку 0-10 считает AI при сохранении — select для ручной правки не
  // рендерится, пока не нажали "✎", поэтому его не будет и в FormData: сервер
  // узнаёт "правку не трогали" просто по отсутствию scoreOverride_<id>.
  const [editingScore, setEditingScore] = useState(false);

  const reasonLabel =
    outcome === "done" ? "Почему получилось?" : outcome === "partial" ? "Что успели сделать?" : "Почему не получилось?";
  const reasonDefault = outcome === "not_done" ? task.whyFailed ?? "" : task.whySucceeded ?? "";
  // Textarea ниже остаётся неконтролируемой (defaultValue+key, см. форму
  // целиком) — это отдельная копия того же текста, только чтобы ссылка в
  // Дневник обновлялась по мере ввода, не завязываясь на состояние формы.
  const [reasonLive, setReasonLive] = useState(reasonDefault);

  // Исход задаёт цвет левой кромки карточки: разобранные задачи видно
  // одним взглядом по колонке, без чтения каждого блока.
  const edgeClass =
    outcome === "done" ? "bg-emerald-500" : outcome === "partial" ? "bg-blue-400" : "bg-neutral-300";

  return (
    <div className="relative surface overflow-hidden pl-4 pr-3.5 py-3 space-y-3">
      <span aria-hidden className={`absolute left-0 inset-y-0 w-1 ${edgeClass}`} />
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm flex-1 min-w-0 truncate font-medium text-neutral-900 flex items-center gap-1.5">
          {outcome === "done" && <IconCheck size={14} className="text-emerald-600 shrink-0" />}
          {outcome === "partial" && <IconHalfCircle size={14} className="text-blue-500 shrink-0" />}
          {task.text}
        </p>
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="inline-flex items-center gap-1 text-[11px] text-neutral-500 hover:text-neutral-900 shrink-0 rounded-md px-1.5 py-1 transition-colors"
        >
          {collapsed ? "Показать" : "Свернуть"}
          <IconChevronDown size={12} className={`transition-transform ${collapsed ? "" : "rotate-180"}`} />
        </button>
      </div>

      <div className={collapsed ? "hidden" : "space-y-3"}>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
          {task.projectName ? <span>{task.projectName}</span> : null}
          <PriorityTag task={task} />
        </div>

        {/* Исход — три пилюли-переключателя вместо трёх мелких радиокнопок:
            это главное решение на карточке, и попадать в него нужно легко,
            в том числе пальцем. */}
        <div className="grid grid-cols-3 gap-1.5">
          {(
            [
              ["done", "Выполнена", "peer-checked:bg-emerald-50 peer-checked:text-emerald-700 peer-checked:ring-emerald-300"],
              ["partial", "Частично", "peer-checked:bg-blue-50 peer-checked:text-blue-700 peer-checked:ring-blue-300"],
              ["not_done", "Не выполнена", "peer-checked:bg-neutral-100 peer-checked:text-neutral-800 peer-checked:ring-neutral-400"],
            ] as [Outcome, string, string][]
          ).map(([value, label, activeClass]) => (
            <label key={value} className="contents">
              <input
                type="radio"
                name={`outcome_${task.id}`}
                value={value}
                checked={outcome === value}
                onChange={() => {
                  setOutcome(value);
                  setReasonLive(value === "not_done" ? task.whyFailed ?? "" : task.whySucceeded ?? "");
                }}
                className="peer sr-only"
              />
              <span
                className={`flex items-center justify-center text-center text-[12px] leading-tight px-2 py-2 rounded-lg ring-1 ring-neutral-200 bg-white text-neutral-600 cursor-pointer transition-colors hover:bg-neutral-50 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ink-500 peer-checked:font-medium ${activeClass}`}
              >
                {label}
              </span>
            </label>
          ))}
        </div>

        <label className="block">
          <span className="block text-xs font-medium text-neutral-600 mb-1.5">{reasonLabel}</span>
          <textarea
            key={outcome}
            name={`reason_${task.id}`}
            rows={2}
            defaultValue={reasonDefault}
            onChange={(e) => setReasonLive(e.target.value)}
            className="field resize-none"
          />
        </label>

        {outcome === "not_done" && (
          <label className="flex items-center gap-2 text-xs text-neutral-600">
            <input
              type="checkbox"
              name={`reschedule_${task.id}`}
              // Не отмечена по умолчанию — перенос на другой день должен быть
              // осознанным решением каждый раз, а не тем, что можно случайно
              // не заметить и получить бесконечно катящуюся вперёд задачу.
              defaultChecked={false}
            />
            Перенести дальше (будни — выходные пропускаем)
          </label>
        )}
        {outcome === "partial" && (
          <p className="text-xs text-neutral-500">Оставшееся автоматически продолжится на ближайший будний день.</p>
        )}

        {(outcome === "partial" || outcome === "not_done") && (
          <a
            href={`${DNEVNIK_URL}/diary/bulk?text=${encodeURIComponent(reasonLive.trim() || task.text)}&taskId=${encodeURIComponent(task.id)}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-ink-700 rounded-md px-1.5 py-1 -mx-1.5 hover:bg-ink-50 transition-colors"
          >
            <IconBookOpen size={13} className="shrink-0" />
            Записать в Дневник
            <IconArrowRight size={12} />
          </a>
        )}

        <div className="flex items-center gap-2 text-xs text-neutral-500 pt-2 border-t border-neutral-100">
          <span>Оценка выполнения: посчитает AI</span>
          {!editingScore ? (
            <button
              type="button"
              onClick={() => setEditingScore(true)}
              className="inline-flex items-center justify-center w-6 h-6 rounded-md text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
              title="Поправить вручную"
              aria-label="Поправить оценку вручную"
            >
              <IconPencil size={13} />
            </button>
          ) : (
            <label className="flex items-center gap-1.5">
              <select
                name={`scoreOverride_${task.id}`}
                defaultValue={task.score ?? 5}
                aria-label="Оценка выполнения"
                className="field field-sm w-auto tabular-nums"
              >
                {SCALE_10.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
              /10
            </label>
          )}
        </div>
      </div>
    </div>
  );
}
