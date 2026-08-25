import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTasksBulk } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BulkNewTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; projectId?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const dateOption = params.date === "today" || params.date === "tomorrow" ? params.date : "backlog";
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  const singleHref = `/tasks/new?date=${dateOption}${params.projectId ? `&projectId=${params.projectId}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Добавить несколько задач сразу</h1>
        <div className="flex gap-3">
          <Link href="/backlog" className="text-xs text-neutral-500 underline hover:text-neutral-800">
            Разобрать с ИИ →
          </Link>
          <Link href={singleHref} className="text-xs text-neutral-500 underline hover:text-neutral-800">
            ← Добавить одну (с приоритетами)
          </Link>
        </div>
      </div>

      <form action={createTasksBulk} className="space-y-4 bg-white border border-neutral-200 rounded-lg p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Список задач — одна строка = одна задача</label>
          <textarea
            name="lines"
            required
            rows={8}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm font-mono"
            placeholder={"отправить клиенту согласованную смету\nзабронировать зал на встречу\nсогласовать текст рассылки"}
          />
          <p className="mt-1 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5">
            Памятка: формулируйте конкретно, через результат действия, а не поверхностно. Плохо:
            «поработать над проектом». Хорошо: «отправить клиенту согласованную смету».
          </p>
          <p className="mt-1 text-xs text-neutral-500">
            Всем задачам поставится средний приоритет по всем критериям и 30 минут — поправите
            у каждой отдельно, открыв задачу после сохранения.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Проект (один на все задачи)</label>
          <select
            name="projectId"
            defaultValue={params.projectId ?? ""}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          >
            <option value="">Без проекта</option>
            {projectOptions.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Куда добавить</label>
          <select
            name="dateOption"
            defaultValue={dateOption}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          >
            <option value="backlog">Позже (без даты)</option>
            <option value="today">На сегодня</option>
            <option value="tomorrow">На завтра (черновик)</option>
          </select>
        </div>

        <button
          type="submit"
          className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
        >
          Добавить все задачи
        </button>
      </form>
    </div>
  );
}
