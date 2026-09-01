"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const NAV_KEYS: Record<string, string> = {
  n: "/add",
  p: "/today",
  z: "/today?view=all",
  h: "/history",
};

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el.isContentEditable;
}

// Единственная точка входа для горячих клавиш — без них не узнать, что они вообще
// есть, поэтому "?" не просто переключает подсказку, а сама подсказка держится
// в углу экрана как маленькая, но всегда доступная кнопка.
export default function KeyboardShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Единственная подсказка о клавишах — маленькая "?" в углу — легко не заметить
  // вовсе. Один раз при первом визите открываем её сами, дальше — как обычно,
  // по клику; факт показа запоминаем, чтобы не навязывать это каждый раз.
  useEffect(() => {
    queueMicrotask(() => {
      try {
        if (!localStorage.getItem("pd-id:shortcuts-seen")) {
          setOpen(true);
          localStorage.setItem("pd-id:shortcuts-seen", "1");
        }
      } catch {}
    });
  }, []);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      const path = NAV_KEYS[e.key.toLowerCase()];
      if (path) {
        e.preventDefault();
        router.push(path);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-neutral-400 hover:text-neutral-700 text-sm w-6 h-6 rounded border border-neutral-300 hover:bg-neutral-50 flex items-center justify-center shrink-0"
        title="Горячие клавиши"
        aria-label="Горячие клавиши"
      >
        ?
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-30 w-56 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-sm space-y-1.5">
          <p className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-1.5">Горячие клавиши</p>
          {[
            ["n", "Добавить AI"],
            ["p", "План дня"],
            ["z", "Все задачи"],
            ["h", "История"],
            ["?", "Эта подсказка"],
          ].map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <span className="text-neutral-600">{label}</span>
              <kbd className="text-xs bg-neutral-100 border border-neutral-300 rounded px-1.5 py-0.5 font-mono">{key}</kbd>
            </div>
          ))}
          <p className="text-[11px] text-neutral-400 pt-1 border-t border-neutral-100">Не работают, пока курсор в поле ввода.</p>
        </div>
      )}
    </div>
  );
}
