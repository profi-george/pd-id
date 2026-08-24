"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import Sidebar from "@/components/Sidebar";
import AccountMenu from "@/components/AccountMenu";
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
          <Link href="/backlog" className="font-semibold text-neutral-800 tracking-tight hover:text-ink-600">
            ПД-ИД
          </Link>
          <AccountMenu cabinetName={cabinetName} />
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
          <Sidebar
            projects={projects}
            counts={counts}
            noProjectCount={noProjectCount}
            totalCount={totalCount}
          />
        </div>
        <main className="flex-1 min-w-0 max-w-4xl mx-auto w-full px-4 py-6 overflow-y-auto">{children}</main>
      </div>
    </>
  );
}
