"use client";

import { useEffect, useRef, useState } from "react";

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
        className="w-3.5 h-3.5 inline-flex items-center justify-center rounded-full border border-neutral-300 text-[9px] text-neutral-400 hover:border-ink-500 hover:text-ink-600 leading-none"
      >
        ?
      </button>
      {open && (
        <div className="absolute z-50 right-0 top-5 w-72 bg-white border border-neutral-200 rounded-lg shadow-lg p-3 text-xs space-y-2">
          <p className="font-medium text-neutral-800">{title}</p>
          <p className="text-neutral-600">{definition}</p>

          {reasoning && (
            <div className="border-l-2 border-ink-500/30 pl-2 py-0.5">
              <p className="text-neutral-500 font-medium mb-0.5">Почему AI поставил такую оценку:</p>
              <p className="italic text-ink-600">{reasoning}</p>
            </div>
          )}

          {scale && scale.length > 0 && (
            <div className="pt-1 border-t border-neutral-100">
              <p className="text-neutral-500 font-medium mb-0.5">Шкала:</p>
              <ul className="space-y-0.5 text-neutral-500">
                {scale.map((s, i) => (
                  <li key={i}>{i + 1} — {s}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </span>
  );
}
