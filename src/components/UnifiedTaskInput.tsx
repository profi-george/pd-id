"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chatStep, createTasksWithDetails } from "@/app/(app)/actions";
import { todayDate, nextWeekday, toDateInputValue } from "@/lib/dates";
import type { AiTaskEvaluation, ChatMessage } from "@/lib/ai";
import SuggestedTasksEditor, { type ReviewTask, type ProjectOption } from "@/components/SuggestedTasksEditor";
import VoiceInputButton from "@/components/VoiceInputButton";

const noSubscription = () => () => {};
function getIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  // Тач-устройство без физической клавиатуры — Enter там должен просто переносить
  // строку, а не отправлять: на телефоне нет удобного Shift рядом, чтобы набрать
  // текст с переносами, а случайная отправка на середине мысли — раздражает.
  return window.matchMedia("(pointer: coarse)").matches;
}

const MAX_TEXTAREA_HEIGHT = 320;

// Черновик живёт только в памяти вкладки — случайно закрытая вкладка или переход
// по ссылке в сайдбаре стирали работу ИИ и правки без единого предупреждения.
// Храним в localStorage и восстанавливаем при заходе на страницу; чистим сразу,
// как только задачи реально сохранены (см. reset()).
const DRAFT_KEY = "pd-id:add-draft:v1";

type Draft = {
  history: ChatMessage[];
  pendingQuestion: string | null;
  input: string;
  pendingTasks: AiTaskEvaluation[] | null;
  reviewTasks: ReviewTask[] | null;
};

function loadDraft(): Draft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

// Статичное "Думаю…" не отличить от зависшего запроса — по одной фразе не понять,
// идёт ли обработка вообще. Смена фразы каждые ~1.6с — самый дешёвый честный сигнал
// "процесс идёт", без реального прогресс-бара (шагов AI-цепочки мы не знаем заранее).
const THINKING_PHRASES = ["Думаю…", "Читаю задачу…", "Прикидываю приоритет…", "Ещё немного…"];

function useThinkingPhrase(active: boolean): string {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setI((v) => (v + 1) % THINKING_PHRASES.length), 1600);
    return () => { clearInterval(id); setI(0); };
  }, [active]);
  return active ? THINKING_PHRASES[i] : THINKING_PHRASES[0];
}

export default function UnifiedTaskInput({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const isMobile = useSyncExternalStore(noSubscription, getIsMobile, () => false);
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Промежуточный шаг: AI закончил разбор (done=true), но это ещё не карточки для
  // редактирования — сначала показываем понятную сводку, чтобы можно было поправить
  // текстом ("нет, вторая задача не на сегодня"), и только по явному "Продолжить"
  // переходим к подробному редактору.
  const [pendingTasks, setPendingTasks] = useState<AiTaskEvaluation[] | null>(null);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[] | null>(null);
  const [isSending, startSending] = useTransition();
  const [isSaving, startSaving] = useTransition();
  const thinkingPhrase = useThinkingPhrase(isSending);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [draftLoaded, setDraftLoaded] = useState(false);

  // Восстанавливаем черновик один раз при заходе на страницу — после первого
  // рендера, чтобы не спорить с серверной разметкой (там localStorage не виден).
  useEffect(() => {
    // Обёрнуто в микротаск: это чтение внешнего источника (localStorage) на
    // старте, а не синхронная реакция на рендер — тот же принцип, что и в
    // useThinkingPhrase выше, просто через другую механику отложенного вызова.
    queueMicrotask(() => {
      const draft = loadDraft();
      if (draft) {
        setHistory(draft.history);
        setPendingQuestion(draft.pendingQuestion);
        setInput(draft.input);
        setPendingTasks(draft.pendingTasks);
        setReviewTasks(draft.reviewTasks);
      }
      setDraftLoaded(true);
    });
  }, []);

  // Сохраняем черновик при любом изменении — но только после того, как восстановление
  // отработало, иначе первая же запись пустого состояния затёрла бы ещё не прочитанный черновик.
  useEffect(() => {
    if (!draftLoaded) return;
    const hasDraft = history.length > 0 || Boolean(input.trim()) || Boolean(pendingTasks) || Boolean(reviewTasks);
    try {
      if (hasDraft) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({ history, pendingQuestion, input, pendingTasks, reviewTasks })
        );
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {}
  }, [draftLoaded, history, pendingQuestion, input, pendingTasks, reviewTasks]);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`;
  }, [input]);

  // Автофокус только на десктопе: на мобильном он тут же поднимает клавиатуру,
  // перекрывая половину экрана прежде, чем человек вообще посмотрел на страницу.
  useEffect(() => {
    if (!isMobile) textareaRef.current?.focus();
  }, [isMobile]);

  function reset() {
    setHistory([]);
    setPendingQuestion(null);
    setInput("");
    setPendingTasks(null);
    setReviewTasks(null);
    setError(null);
    try { localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setError(null);
    const currentHistory = history;

    startSending(async () => {
      const res = await chatStep(currentHistory, text);

      if (!res.ok) {
        // Текст остаётся в поле как есть — ничего не потеряно, можно просто
        // нажать "Отправить" ещё раз, не печатая/не диктуя заново.
        setError(res.error);
        return;
      }

      setInput("");
      setHistory([...currentHistory, { role: "user", text }]);
      const result = res.result;
      if (result.done) {
        setPendingQuestion(null);
        setPendingTasks(result.tasks);
      } else {
        setPendingTasks(null);
        setPendingQuestion(result.question);
        setHistory((prev) => [...prev, { role: "assistant", text: result.question }]);
      }
    });
  }

  function handleConfirm() {
    if (!pendingTasks) return;
    // Если AI не понял явный день из текста — по умолчанию ставим на сегодня,
    // но только если сегодня будний день. На выходных без явного "в субботу"/
    // "в воскресенье" день молча сдвигается на ближайший понедельник — автоматом
    // на выходные ничего не ставим.
    const defaultDateISO = toDateInputValue(nextWeekday(todayDate()));
    setReviewTasks(
      pendingTasks.map((t) => ({
        ...t,
        projectId: t.suggestedProjectId,
        // По умолчанию — в план (на сегодня/ближайший будний, либо на дату, которую
        // AI понял из текста): именно это и написано в подписи чекбокса на карточке.
        // Раньше по умолчанию было false, если AI не нашёл явную дату в тексте —
        // задача тихо уходила в бэклог, хотя пользователь ожидал увидеть её
        // в плане дня. Снять галочку всё ещё можно вручную.
        includeInPlan: true,
        scheduledDate: t.scheduledDate ?? defaultDateISO,
      }))
    );
    setPendingTasks(null);
  }

  function handleSave() {
    if (!reviewTasks || reviewTasks.length === 0) return;
    const anyInPlan = reviewTasks.some((t) => t.includeInPlan);
    startSaving(async () => {
      await createTasksWithDetails(reviewTasks);
      reset();
      router.push(anyInPlan ? "/today" : "/today?view=all");
    });
  }

  const hasDraft = history.length > 0 || Boolean(input.trim()) || Boolean(pendingTasks) || Boolean(reviewTasks);

  return (
    <div className="space-y-4">
      {hasDraft && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={reset}
            className="text-xs text-neutral-400 hover:text-red-600 hover:underline"
          >
            Очистить черновик и начать заново
          </button>
        </div>
      )}
      {!reviewTasks && (
        <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 shadow-sm">
          <p className="text-base font-medium text-neutral-800">
            {pendingQuestion ?? "Что нужно сделать?"}
          </p>

          {pendingTasks && (
            <div className="space-y-1.5 bg-neutral-50 border border-neutral-200 rounded-lg p-3">
              <p className="text-xs font-medium text-neutral-500">Вот что получилось:</p>
              <ul className="space-y-1">
                {pendingTasks.map((t, i) => (
                  <li key={i} className="text-sm text-neutral-700">
                    <span className="font-medium">{t.text}</span>
                    {t.primaryReason && <span className="text-neutral-500"> — {t.primaryReason}</span>}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={handleConfirm}
                className="w-full text-sm px-3 py-1.5 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 mt-1"
              >
                Продолжить и настроить →
              </button>
              <p className="text-xs text-neutral-400">
                Что-то не так? Напишите поправку ниже — например «нет, вторая задача не срочная».
              </p>
            </div>
          )}

          <textarea
            ref={textareaRef}
            rows={pendingQuestion || pendingTasks ? 2 : 5}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !isMobile) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={
              pendingTasks
                ? "Поправка (необязательно)..."
                : pendingQuestion
                ? "Ваш ответ..."
                : "Напиши или надиктуй всё, что сейчас нужно..."
            }
            className="w-full border-none outline-none resize-none text-sm text-neutral-700 placeholder:text-neutral-400"
            style={{ maxHeight: MAX_TEXTAREA_HEIGHT }}
          />
          <div className="flex items-center justify-between pt-1 border-t border-neutral-100">
            <VoiceInputButton onText={(t) => setInput((prev) => (prev ? `${prev} ${t}` : t))} />
            <button
              type="button"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="text-sm px-4 py-1.5 rounded-full bg-neutral-800 text-white hover:bg-neutral-700 disabled:opacity-40"
            >
              {isSending ? thinkingPhrase : "Разобрать →"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">
              {error}{" "}
              <Link href="/tasks/new" className="underline hover:text-red-800">
                Добавить вручную →
              </Link>
            </p>
          )}
        </div>
      )}

      {reviewTasks && (
        <SuggestedTasksEditor
          tasks={reviewTasks}
          onChange={setReviewTasks}
          projects={projects}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
