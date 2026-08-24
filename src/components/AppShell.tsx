"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import type { ProjectNode } from "@/lib/projectTree";
import { logoutAction } from "@/app/login/actions";

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
      <header className="border-b border-neutral-200 bg-neutral-50 shrink-0">
        <nav className="flex items-center gap-4 sm:gap-6 px-4 py-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="md:hidden text-neutral-600 hover:text-neutral-900 -ml-1 p-1"
            aria-label="Открыть меню"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" />
            </svg>
          </button>
          <span className="font-semibold text-neutral-800 tracking-tight">ПД-ИД</span>
          <Link href="/today" className="hidden md:inline text-sm text-neutral-600 hover:text-neutral-900">
            План дня
          </Link>
          <Link href="/backlog" className="hidden md:inline text-sm text-neutral-600 hover:text-neutral-900">
            Задачи
          </Link>
          <Link href="/projects" className="hidden md:inline text-sm text-neutral-600 hover:text-neutral-900">
            Проекты
          </Link>
          <Link href="/settings" className="hidden md:inline text-sm text-neutral-600 hover:text-neutral-900 ml-auto">
            Настройки
          </Link>
        </nav>
      </header>
      <div className="flex flex-1 min-h-0">
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}
        <div
          className={`${
            mobileOpen ? "fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw]" : "hidden"
          } md:static md:block md:z-auto md:w-auto md:max-w-none`}
        >
          <div className="h-full flex flex-col">
            <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50 flex items-center justify-between shrink-0">
              <span className="text-xs text-neutral-500 truncate" title={cabinetName}>
                {cabinetName}
              </span>
              <form action={logoutAction}>
                <button type="submit" className="text-xs text-neutral-400 hover:text-neutral-700 shrink-0">
                  Выйти
                </button>
              </form>
            </div>
            <div className="flex-1 min-h-0">
              <Sidebar
                projects={projects}
                counts={counts}
                noProjectCount={noProjectCount}
                totalCount={totalCount}
              />
            </div>
          </div>
        </div>
        <main className="flex-1 min-w-0 max-w-4xl mx-auto w-full px-4 py-6 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
