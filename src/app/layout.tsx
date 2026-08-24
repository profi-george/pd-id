import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import Sidebar from "@/components/Sidebar";
import "./globals.css";

const manrope = Manrope({
  subsets: ["latin", "cyrillic"],
  variable: "--font-manrope",
});

export const metadata: Metadata = {
  title: "ПД-ИД — План дня, Итог дня",
  description: "Личный инструмент ежедневного планирования и рефлексии",
};

const ACTIVE_STATUSES = [TaskStatus.BACKLOG, TaskStatus.PLANNED];

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [projects, tasks] = await Promise.all([
    prisma.project.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.task.findMany({
      where: { status: { in: ACTIVE_STATUSES } },
      select: { projectId: true },
    }),
  ]);

  const projectNodes = projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }));
  const byId = new Map(projectNodes.map((p) => [p.id, p]));

  const ownCounts: Record<string, number> = {};
  let noProjectCount = 0;
  for (const t of tasks) {
    if (!t.projectId) {
      noProjectCount++;
      continue;
    }
    ownCounts[t.projectId] = (ownCounts[t.projectId] ?? 0) + 1;
  }

  // Счётчик верхнего проекта включает задачи всех его подпроектов.
  const counts: Record<string, number> = { ...ownCounts };
  for (const p of projectNodes) {
    if (p.parentId && byId.has(p.parentId)) {
      counts[p.parentId] = (counts[p.parentId] ?? 0) + (ownCounts[p.id] ?? 0);
    }
  }

  return (
    <html lang="ru" className={`h-full antialiased ${manrope.variable}`}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900">
        <header className="border-b border-neutral-200 bg-neutral-50 shrink-0">
          <nav className="flex items-center gap-6 px-4 py-3">
            <span className="font-semibold text-neutral-800 tracking-tight">ПД-ИД</span>
            <Link href="/today" className="text-sm text-neutral-600 hover:text-neutral-900">
              Сегодня
            </Link>
            <Link href="/backlog" className="text-sm text-neutral-600 hover:text-neutral-900">
              Позже
            </Link>
            <Link href="/projects" className="text-sm text-neutral-600 hover:text-neutral-900">
              Проекты
            </Link>
            <Link href="/settings" className="text-sm text-neutral-600 hover:text-neutral-900 ml-auto">
              Настройки
            </Link>
          </nav>
        </header>
        <div className="flex flex-1 min-h-0">
          <Sidebar
            projects={projectNodes}
            counts={counts}
            noProjectCount={noProjectCount}
            totalCount={tasks.length}
          />
          <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 overflow-y-auto">{children}</main>
        </div>
      </body>
    </html>
  );
}
