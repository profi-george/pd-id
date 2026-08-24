import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import AppShell from "@/components/AppShell";
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
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 overflow-x-hidden">
        <AppShell
          projects={projectNodes}
          counts={counts}
          noProjectCount={noProjectCount}
          totalCount={tasks.length}
        >
          {children}
        </AppShell>
      </body>
    </html>
  );
}
