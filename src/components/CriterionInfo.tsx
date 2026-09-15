"use client";

import { useEffect, useRef, useState } from "react";
import { IconHelp } from "@/components/icons";

export default function CriterionInfo({
  title,
  definition,
  scale,
  reasoning,
}: {
  title: string;
  definition: string;
  scale?: string[];
  reasoning?: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group inline-flex items-center justify-center p-1.5 -m-1.5 align-middle"
        aria-label={`Подробнее: ${title}`}
      >
        <IconHelp size={14} className="text-neutral-400 group-hover:text-ink-600 transition-colors" />
      </button>
      {open && (
        <div className="menu-panel absolute z-50 left-0 top-6 w-72 max-w-[85vw] p-3 text-xs space-y-2.5">
          <p className="font-semibold text-neutral-900 text-[13px]">{title}</p>
          <p className="text-neutral-600 leading-relaxed">{definition}</p>

          {reasoning && (
            <div className="ai-note py-0.5">
              <p className="text-neutral-500 font-medium mb-0.5 not-italic">Почему AI поставил такую оценку:</p>
              <p className="leading-relaxed">{reasoning}</p>
            </div>
          )}

          {scale && scale.length > 0 && (
            <div className="pt-2 border-t border-neutral-100">
              <p className="text-neutral-500 font-medium mb-1">Шкала:</p>
              <ul className="space-y-1 text-neutral-500">
                {scale.map((s, i) => (
                  <li key={i} className="flex gap-1.5">
                    <span className="tabular-nums font-medium text-neutral-400 shrink-0">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
