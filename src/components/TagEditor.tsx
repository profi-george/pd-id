"use client";

import { useState } from "react";
import { IconX } from "@/components/icons";

export type TagItem = { id: string; name: string };

// Метки задачи плашками + поле ввода: Enter/запятая добавляет метку, клик по
// подсказке — уже существующую. Незнакомое название станет новой меткой на
// сервере (см. setTaskTags), поэтому здесь работаем просто со списком названий.
export default function TagEditor({
  tags,
  allTags,
  onChange,
}: {
  tags: TagItem[];
  allTags: TagItem[];
  onChange: (names: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const names = tags.map((t) => t.name);
  const lower = new Set(names.map((n) => n.toLowerCase()));
  const query = input.trim().toLowerCase();
  const suggestions = allTags.filter((t) => !lower.has(t.name.toLowerCase()) && (!query || t.name.toLowerCase().includes(query)));

  function add(name: string) {
    const clean = name.trim().replace(/\s+/g, " ");
    setInput("");
    if (!clean || lower.has(clean.toLowerCase())) return;
    // Регистр берём у уже существующей метки, чтобы "ии" не плодил дубль "ИИ".
    const existing = allTags.find((t) => t.name.toLowerCase() === clean.toLowerCase());
    onChange([...names, existing?.name ?? clean]);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {tags.map((t) => (
          <span key={t.id} className="inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-700 text-xs px-2.5 py-1">
            #{t.name}
            <button
              type="button"
              aria-label={`Убрать метку ${t.name}`}
              onClick={() => onChange(names.filter((n) => n !== t.name))}
              className="text-indigo-400 hover:text-indigo-700"
            >
              <IconX size={12} />
            </button>
          </span>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add(input);
            } else if (e.key === "Backspace" && !input && names.length) {
              onChange(names.slice(0, -1));
            }
          }}
          placeholder={tags.length ? "+ метка" : "Добавить метку…"}
          className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none py-1 placeholder:text-neutral-400"
        />
      </div>
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {suggestions.slice(0, 12).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => add(t.name)}
              className="rounded-full border border-neutral-200 text-xs text-neutral-600 px-2.5 py-1 hover:border-indigo-300 hover:text-indigo-700"
            >
              + {t.name}
            </button>
          ))}
        </div>
      )}
      {query && !allTags.some((t) => t.name.toLowerCase() === query) && (
        <p className="text-[11px] text-neutral-400 mt-1.5">Enter — создать метку «{input.trim()}»</p>
      )}
    </div>
  );
}
