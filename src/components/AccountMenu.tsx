"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";

export default function AccountMenu({ cabinetName }: { cabinetName: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-neutral-600 hover:text-neutral-900"
      >
        <span className="w-6 h-6 shrink-0 rounded-full bg-ink-50 text-ink-600 flex items-center justify-center text-xs font-semibold">
          {cabinetName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[8rem] truncate">{cabinetName}</span>
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-50 w-44 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 text-sm">
          <p className="px-3 py-1.5 text-xs text-neutral-400 truncate border-b border-neutral-100" title={cabinetName}>
            {cabinetName}
          </p>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-1.5 hover:bg-neutral-50 text-neutral-700"
          >
            Настройки
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="w-full text-left px-3 py-1.5 hover:bg-neutral-50 text-red-600">
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
