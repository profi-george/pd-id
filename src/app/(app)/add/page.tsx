import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import UnifiedTaskInput from "@/components/UnifiedTaskInput";

export const dynamic = "force-dynamic";

export default async function AddPage() {
  const user = await requireUser();
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-display font-bold">Добавить задачи</h1>
        <p className="text-sm text-neutral-500">Выгрузите всё, что сейчас в голове — дальше разберём вместе.</p>
      </div>

      <div className="space-y-1.5">
        <UnifiedTaskInput projects={projectOptions} />
        <Link href="/tasks/new" className="block text-xs text-neutral-400 hover:text-neutral-700 text-right">
          Добавить вручную, без AI →
        </Link>
      </div>
    </div>
  );
}
