import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import UnifiedTaskInput from "@/components/UnifiedTaskInput";
import { IconArrowRight } from "@/components/icons";

export const dynamic = "force-dynamic";

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ text?: string }>;
}) {
  const user = await requireUser();
  const { text } = await searchParams;
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  return (
    <div className="space-y-7 max-w-2xl mx-auto">
      <div className="text-center sm:text-left">
        <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">Добавить задачи</h1>
        <p className="text-sm text-neutral-500 mt-1 leading-relaxed">
          Выгрузите всё, что сейчас в голове — дальше разберём вместе.
        </p>
      </div>

      <div className="space-y-2">
        <UnifiedTaskInput projects={projectOptions} initialText={text} />
        <div className="flex justify-end">
          <Link
            href="/tasks/new"
            className="inline-flex items-center gap-1 text-xs text-neutral-500 hover:text-neutral-900 rounded-md px-1.5 py-1 transition-colors"
          >
            Добавить вручную, без AI
            <IconArrowRight size={12} />
          </Link>
        </div>
      </div>
    </div>
  );
}
