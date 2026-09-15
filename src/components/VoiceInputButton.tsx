"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { IconMic } from "@/components/icons";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  start: () => void;
  stop: () => void;
};

function getSpeechRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike;
    webkitSpeechRecognition?: new () => SpeechRecognitionLike;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

const ERROR_MESSAGES: Record<string, string> = {
  "not-allowed": "Нет доступа к микрофону — разрешите его в настройках браузера.",
  "service-not-allowed": "Нет доступа к микрофону — разрешите его в настройках браузера.",
  "no-speech": "Не расслышала — попробуйте ещё раз.",
  network: "Проблема с сетью, попробуйте ещё раз.",
  "audio-capture": "Не нашла микрофон.",
};

const noSubscription = () => () => {};

export default function VoiceInputButton({
  onText,
  className,
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  // "idle" — не слушает; "listening" — идёт запись; "processing" — запись остановлена,
  // ждём финальный результат распознавания (между stop() и onresult/onend).
  const [status, setStatus] = useState<"idle" | "listening" | "processing">("idle");
  const [error, setError] = useState<string | null>(null);
  // Поддержка браузером известна только на клиенте; чтобы верстка на сервере и при
  // гидратации совпадала, используем useSyncExternalStore с серверным снепшотом = true.
  const supported = useSyncExternalStore(
    noSubscription,
    () => getSpeechRecognitionCtor() !== null,
    () => true
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;
    const recognition = new Ctor();
    recognition.lang = "ru-RU";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onstart = () => setStatus("listening");
    recognition.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      if (text.trim()) onTextRef.current(text.trim());
    };
    recognition.onend = () => setStatus("idle");
    recognition.onerror = (e) => {
      setStatus("idle");
      if (e.error === "aborted") return; // штатная остановка пользователем, не ошибка
      setError(ERROR_MESSAGES[e.error ?? ""] ?? "Не удалось распознать речь.");
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
      errorTimerRef.current = setTimeout(() => setError(null), 4000);
    };
    recognitionRef.current = recognition;
    return () => { if (errorTimerRef.current) clearTimeout(errorTimerRef.current); };
  }, []);

  if (!supported) return null;

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    if (status !== "idle") {
      recognition.stop();
      setStatus("processing");
    } else {
      recognition.start();
    }
  }

  return (
    <span className="inline-flex items-center">
      <button
        type="button"
        onClick={toggle}
        aria-label={status === "idle" ? "Надиктовать" : "Остановить диктовку"}
        title={status === "idle" ? "Надиктовать" : "Остановить диктовку"}
        className={
          className ??
          // Во время записи — красное «дышащее» кольцо вокруг кнопки вместо
          // мигания самой кнопки: мигающий орган управления выглядит сломанным,
          // а пульсирующее кольцо читается как «идёт запись».
          `relative w-9 h-9 shrink-0 rounded-full flex items-center justify-center ring-1 transition-colors ${
            status !== "idle"
              ? "ring-red-300 bg-red-50 text-red-600"
              : "ring-neutral-200 bg-white text-neutral-500 hover:ring-ink-300 hover:text-ink-600 shadow-2xs"
          }`
        }
      >
        {status !== "idle" && (
          <span
            aria-hidden
            className="absolute inset-0 rounded-full ring-2 ring-red-400/60 animate-ping"
          />
        )}
        {status !== "idle" ? (
          <span className="w-3 h-3 rounded-sm bg-current" aria-hidden />
        ) : (
          <IconMic size={16} />
        )}
      </button>
      {status === "listening" && (
        <span className="ml-2.5 text-xs font-medium text-red-600">Слушаю…</span>
      )}
      {status === "processing" && (
        <span className="ml-2.5 text-xs text-neutral-500">Распознаю…</span>
      )}
      {error && <span className="ml-2.5 text-xs text-red-600">{error}</span>}
    </span>
  );
}
