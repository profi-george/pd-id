"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
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

const noSubscription = () => () => {};

export default function VoiceInputButton({
  onText,
  className,
}: {
  onText: (text: string) => void;
  className?: string;
}) {
  const [listening, setListening] = useState(false);
  // Поддержка браузером известна только на клиенте; чтобы верстка на сервере и при
  // гидратации совпадала, используем useSyncExternalStore с серверным снепшотом = true.
  const supported = useSyncExternalStore(
    noSubscription,
    () => getSpeechRecognitionCtor() !== null,
    () => true
  );
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTextRef = useRef(onText);

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
    recognition.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        text += e.results[i][0].transcript;
      }
      if (text.trim()) onTextRef.current(text.trim());
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);
    recognitionRef.current = recognition;
  }, []);

  if (!supported) return null;

  function toggle() {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (listening) {
      recognition.stop();
      setListening(false);
    } else {
      recognition.start();
      setListening(true);
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={
        className ??
        `text-xs px-2 py-1 rounded border ${
          listening ? "border-red-400 bg-red-50 text-red-600" : "border-neutral-300 hover:bg-neutral-50"
        }`
      }
    >
      {listening ? "⏹ Стоп" : "🎤 Диктовать"}
    </button>
  );
}
