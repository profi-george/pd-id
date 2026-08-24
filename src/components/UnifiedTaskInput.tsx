"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { chatStep, createTasksWithDetails } from "@/app/(app)/actions";
import type { ChatMessage } from "@/lib/ai";
import SuggestedTasksEditor, { type ReviewTask, type ProjectOption, type DateOption } from "@/components/SuggestedTasksEditor";
import VoiceInputButton from "@/components/VoiceInputButton";

export default function UnifiedTaskInput({ projects }: { projects: ProjectOption[] }) {
  const router = useRouter();
  const [history, setHistory] = useState<ChatMessage[]>([]);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [reviewTasks, setReviewTasks] = useState<ReviewTask[] | null>(null);
  const [dateOption, setDateOption] = useState<DateOption>("backlog");
  const [isSending, startSending] = useTransition();
  const [isSaving, startSaving] = useTransition();

  function reset() {
    setHistory([]);
    setPendingQuestion(null);
    setInput("");
    setReviewTasks(null);
    setError(null);
  }

  function handleSend() {
    const text = input.trim();
    if (!text || isSending) return;
    setError(null);
    const currentHistory = history;
    setInput("");

    startSending(async () => {
      const res = await chatStep(currentHistory, text);
      setHistory([...currentHistory, { role: "user", text }]);

      if (!res.ok) {
        setError(res.error);
        return;
      }
      const result = res.result;
      if (result.done) {
        setPendingQuestion(null);
        setReviewTasks(result.tasks.map((t) => ({ ...t, projectId: t.suggestedProjectId })));
      } else {
        setPendingQuestion(result.question);
        setHistory((prev) => [...prev, { role: "assistant", text: result.question }]);
      }
    });
  }

  function handleSave() {
    if (!reviewTasks || reviewTasks.length === 0) return;
    startSaving(async () => {
      await createTasksWithDetails(reviewTasks, dateOption);
      reset();
      router.push(dateOption === "backlog" ? "/backlog" : "/today");
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white border border-neutral-200 rounded-xl p-5 space-y-3 shadow-sm">
        {!reviewTasks && (
          <>
            <p className="text-base font-medium text-neutral-800">
              {pendingQuestion ?? "Что нужно сделать?"}
            </p>
            <textarea
              autoFocus
              rows={pendingQuestion ? 2 : 3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={pendingQuestion ? "Ваш ответ..." : "Напиши или надиктуй всё, что сейчас нужно..."}
              className="w-full border-none outline-none resize-none text-sm text-neutral-700 placeholder:text-neutral-400"
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
          </>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-2 py-1.5">{error}</p>
        )}
      </div>

      {reviewTasks && (
        <SuggestedTasksEditor
          tasks={reviewTasks}
          onChange={setReviewTasks}
          projects={projects}
          dateOption={dateOption}
          onDateOptionChange={setDateOption}
          onSave={handleSave}
          isSaving={isSaving}
        />
      )}
    </div>
  );
}
