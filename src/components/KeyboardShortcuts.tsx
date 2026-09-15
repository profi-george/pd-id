"use client";

import { useEffect } from "react";
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

// Сами хоткеи (n/p/z/h) без видимого UI — подсказка о них теперь живёт как
// title-тултип на аккаунте в шапке (см. AccountMenu), без отдельной кнопки "?".
export default function KeyboardShortcuts() {
  const router = useRouter();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;

      const path = NAV_KEYS[e.key.toLowerCase()];
      if (path) {
        e.preventDefault();
        router.push(path);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return null;
}
