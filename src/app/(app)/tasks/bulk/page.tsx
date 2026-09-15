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
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">
          Добавить несколько задач сразу
        </h1>
        <div className="flex gap-1.5 shrink-0">
          <Link href="/add" className="btn btn-secondary btn-sm">
            Разобрать с ИИ
          </Link>
          <Link href={singleHref} className="btn btn-secondary btn-sm">
            Добавить одну
          </Link>
        </div>
      </div>

      <form action={createTasksBulk} className="surface space-y-5 p-5">
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Список задач — одна строка = одна задача</label>
          <textarea
            name="lines"
            required
            rows={8}
            className="field font-mono leading-relaxed resize-y"
            placeholder={"отправить клиенту согласованную смету\nзабронировать зал на встречу\nсогласовать текст рассылки"}
          />
          <p className="mt-2 text-xs text-neutral-600 bg-neutral-50 ring-1 ring-neutral-200 rounded-lg px-3 py-2 leading-relaxed">
            Памятка: формулируйте конкретно, через результат действия, а не поверхностно. Плохо:
            «поработать над проектом». Хорошо: «отправить клиенту согласованную смету».
          </p>
          <p className="mt-2 text-xs text-neutral-500 leading-relaxed">
            Всем задачам поставится средний приоритет по всем критериям и 30 минут — поправите
            у каждой отдельно, открыв задачу после сохранения.
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Проект (один на все задачи)</label>
          <select
            name="projectId"
            defaultValue={params.projectId ?? ""}
            className="field"
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
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Куда добавить</label>
          <select
            name="dateOption"
            defaultValue={dateOption}
            className="field"
          >
            <option value="backlog">Позже (без даты)</option>
            <option value="today">На сегодня</option>
            <option value="tomorrow">На завтра (черновик)</option>
          </select>
        </div>

        <button
          type="submit"
          className="btn btn-primary btn-lg w-full"
        >
          Добавить все задачи
        </button>
      </form>
    </div>
  );
}
