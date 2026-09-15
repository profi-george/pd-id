"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { logoutAction } from "@/app/login/actions";
import { IconChevronDown, IconLogout, IconSettings } from "@/components/icons";

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
        className="flex items-center gap-2 rounded-lg pl-1 pr-1.5 py-1 text-[13px] text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/50 transition-colors"
        title={"Горячие клавиши:\nN — Добавить AI\nP — План дня\nZ — Все задачи\nH — История\n(не работают в полях ввода)"}
      >
        <span className="w-7 h-7 shrink-0 rounded-full bg-gradient-to-br from-ink-400 to-ink-600 text-white flex items-center justify-center text-xs font-semibold shadow-xs">
          {cabinetName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden sm:inline max-w-[8rem] truncate">{cabinetName}</span>
        <IconChevronDown size={13} className="hidden sm:block text-neutral-400 shrink-0" />
      </button>

      {open && (
        <div className="menu-panel absolute right-0 top-11 z-50 w-52">
          <p className="px-2 py-1.5 text-[11px] text-neutral-500 truncate" title={cabinetName}>
            {cabinetName}
          </p>
          <div className="my-1 border-t border-neutral-100" />
          <Link href="/settings" onClick={() => setOpen(false)} className="menu-item">
            <IconSettings size={14} className="text-neutral-400 shrink-0" />
            Настройки
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="menu-item menu-item-danger">
              <IconLogout size={14} className="shrink-0" />
              Выйти
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
