"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AccountMenu from "@/components/AccountMenu";
import KeyboardShortcuts from "@/components/KeyboardShortcuts";
import { IconMenu, IconSparkles, IconX } from "@/components/icons";
import type { ProjectNode } from "@/lib/projectTree";

export default function AppShell({
  projects,
  counts,
  noProjectCount,
  totalCount,
  cabinetName,
  children,
}: {
  projects: ProjectNode[];
  counts: Record<string, number>;
  noProjectCount: number;
  totalCount: number;
  cabinetName: string;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const [prevPathname, setPrevPathname] = useState(pathname);

  if (pathname !== prevPathname) {
    setPrevPathname(pathname);
    setMobileOpen(false);
  }

  return (
    <>
      {/* Шапка полупрозрачная с размытием: под ней прокручивается содержимое
          и должно читаться как подложка, а не исчезать за глухой плашкой.
          Снизу — волосок, а не полноценная граница: разделение поверхностей
          нужно обозначить, но не прочертить по экрану линию. */}
      <header className="sticky top-0 z-30 shrink-0 border-b border-neutral-200/80 bg-neutral-50/80 backdrop-blur-xl backdrop-saturate-150">
        <nav className="flex items-center gap-3 px-4 sm:px-5 h-14">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="icon-btn md:hidden -ml-1.5"
            aria-label="Открыть меню"
          >
            <IconMenu size={18} />
          </button>

          {/* Знак + название вместо одного текстового логотипа: «ПД-ИД» —
              аббревиатура, без якоря она читается как случайные буквы. */}
          <Link href="/add" className="group flex items-center gap-2.5 shrink-0" aria-label="ПД-ИД — на главную">
            <span className="w-7 h-7 rounded-lg bg-ink-600 text-white flex items-center justify-center shadow-xs transition-colors group-hover:bg-ink-500">
              <span className="font-display text-[11px] font-extrabold leading-none tracking-tight">ПД</span>
            </span>
            <span className="hidden sm:flex flex-col leading-none">
              <span className="font-display text-[13px] font-bold text-neutral-900 tracking-tight">ПД-ИД</span>
              <span className="text-[10px] text-neutral-500 mt-0.5">План дня · Итог дня</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/add" className="btn btn-primary">
              <IconSparkles size={14} className="shrink-0" />
              Добавить<span className="hidden sm:inline">&nbsp;AI</span>
            </Link>
            <KeyboardShortcuts />
            <AccountMenu cabinetName={cabinetName} />
          </div>
        </nav>
      </header>

      <div className="flex flex-1 min-h-0">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-neutral-950/35 backdrop-blur-[2px] z-40 md:hidden animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={`${
            mobileOpen
              ? "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] shadow-xl animate-fade-in"
              : "hidden"
          } md:static md:block md:z-auto md:w-auto md:max-w-none md:shadow-none`}
        >
          {mobileOpen && (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Закрыть меню"
              className="icon-btn absolute right-2 top-2 z-10 md:hidden"
            >
              <IconX size={18} />
            </button>
          )}
          <Sidebar
            projects={projects}
            counts={counts}
            noProjectCount={noProjectCount}
            totalCount={totalCount}
          />
        </div>
        <main className="flex-1 min-w-0 max-w-4xl mx-auto w-full px-4 sm:px-6 py-6 sm:py-8 pb-24 overflow-y-auto">
          {children}
        </main>
      </div>
    </>
  );
}
