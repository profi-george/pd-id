import { prisma } from "@/lib/prisma";
import { createProjectForm, renameProject, deleteProject } from "@/app/actions";
import { buildProjectTree } from "@/lib/projectTree";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { tasks: true } } },
  });
  const countById = new Map(projects.map((p) => [p.id, p._count.tasks]));
  const tree = buildProjectTree(projects);
  const topLevel = projects.filter((p) => !p.parentId);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Проекты</h1>

      <ul className="space-y-2">
        {tree.map((top) => (
          <li key={top.id} className="space-y-2">
            <div className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2">
              <form action={renameProject.bind(null, top.id)} className="flex-1 flex gap-2">
                <input
                  name="name"
                  defaultValue={top.name}
                  className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm font-medium"
                />
                <button
                  type="submit"
                  className="text-sm px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
                >
                  Сохранить
                </button>
              </form>
              <span className="text-xs text-neutral-500 whitespace-nowrap">
                {countById.get(top.id) ?? 0} задач
              </span>
              <form action={deleteProject.bind(null, top.id)}>
                <button type="submit" className="text-sm px-2 py-1 rounded text-red-600 hover:bg-red-50">
                  Удалить
                </button>
              </form>
            </div>

            {top.children.length > 0 && (
              <ul className="ml-6 space-y-2">
                {top.children.map((sub) => (
                  <li
                    key={sub.id}
                    className="flex items-center gap-2 bg-white border border-neutral-200 rounded-lg px-3 py-2"
                  >
                    <span className="text-neutral-300 text-sm">—</span>
                    <form action={renameProject.bind(null, sub.id)} className="flex-1 flex gap-2">
                      <input
                        name="name"
                        defaultValue={sub.name}
                        className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm"
                      />
                      <button
                        type="submit"
                        className="text-sm px-2 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
                      >
                        Сохранить
                      </button>
                    </form>
                    <span className="text-xs text-neutral-500 whitespace-nowrap">
                      {countById.get(sub.id) ?? 0} задач
                    </span>
                    <form action={deleteProject.bind(null, sub.id)}>
                      <button type="submit" className="text-sm px-2 py-1 rounded text-red-600 hover:bg-red-50">
                        Удалить
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {projects.length === 0 && (
          <li className="text-sm text-neutral-500">Проектов пока нет.</li>
        )}
      </ul>

      <div className="bg-white border border-neutral-200 rounded-lg p-3 space-y-2">
        <h2 className="text-sm font-medium mb-2">Новый проект</h2>
        <form action={createProjectForm} className="flex gap-2">
          <input
            name="name"
            placeholder="Название проекта"
            required
            className="flex-1 border border-neutral-300 rounded px-2 py-1 text-sm"
          />
          <select name="parentId" className="border border-neutral-300 rounded px-2 py-1 text-sm">
            <option value="">Обычный проект</option>
            {topLevel.map((p) => (
              <option key={p.id} value={p.id}>Подпроект в «{p.name}»</option>
            ))}
          </select>
          <button
            type="submit"
            className="text-sm px-3 py-1 rounded bg-neutral-800 text-white hover:bg-neutral-700"
          >
            Добавить
          </button>
        </form>
        <p className="text-xs text-neutral-400">
          Удаление проекта удаляет и все его подпроекты (задачи внутри при этом не теряются — просто
          остаются без проекта).
        </p>
      </div>
    </div>
  );
}
