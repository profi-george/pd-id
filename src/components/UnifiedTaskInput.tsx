"use client";

import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chatStep, createTasksWithDetails } from "@/app/(app)/actions";
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
    setReviewTasks(
      pendingTasks.map((t) => ({
        ...t,
        projectId: t.suggestedProjectId,
        // По умолчанию — в план (на сегодня, либо на дату, которую AI понял из
        // текста): именно это и написано в подписи чекбокса на этой карточке.
        // Раньше по умолчанию было false, если AI не нашёл явную дату в тексте —
        // задача тихо уходила в бэклог, хотя пользователь ожидал увидеть её
        // в плане дня. Снять галочку всё ещё можно вручную.
        includeInPlan: true,
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
      router.push(anyInPlan ? "/today" : "/backlog");
    });
  }

  return (
    <div className="space-y-4">
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
              {isSending ? "Думаю…" : "Отправить →"}
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
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
