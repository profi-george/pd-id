import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { CRITERIA_INFO } from "@/lib/criteriaInfo";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCALE = [1, 2, 3, 4, 5];

export default async function NewTaskPage({
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

  const aiHref = "/backlog";
  const bulkHref = `/tasks/bulk?date=${dateOption}${params.projectId ? `&projectId=${params.projectId}` : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Новая задача (вручную)</h1>
        <div className="flex gap-3">
          <Link href={aiHref} className="text-xs text-neutral-500 underline hover:text-neutral-800">
            Пусть оценит ИИ →
          </Link>
          <Link href={bulkHref} className="text-xs text-neutral-500 underline hover:text-neutral-800">
            Добавить несколько сразу →
          </Link>
        </div>
      </div>
      <p className="text-xs text-neutral-500 -mt-2">
        Обычно проще продиктовать задачу ИИ — он сам оценит критерии ниже. Эта форма для случаев,
        когда вы точно знаете оценки сами или нет доступа к ИИ.
      </p>

      <form action={createTask} className="space-y-4 bg-white border border-neutral-200 rounded-lg p-4">
        <div>
          <label className="block text-sm font-medium mb-1">Формулировка задачи</label>
          <textarea
            name="text"
            required
            rows={2}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            placeholder="Например: отправить черновик договора клиенту на согласование"
          />
          <p className="mt-1 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5">
            Памятка: формулируйте конкретно, через результат действия — что именно будет
            сделано/готово, а не поверхностно и не процессом. Плохо: «поработать над проектом».
            Хорошо: «отправить клиенту согласованную смету».
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ожидаемый результат (необязательно)</label>
          <input
            name="resultText"
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            placeholder="Что станет возможным/готовым после выполнения"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Проект</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">{CRITERIA_INFO.value.title} (1–5)</label>
            <select name="value" defaultValue="3" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{CRITERIA_INFO.costOfDelay.title} (1–5)</label>
            <select name="costOfDelay" defaultValue="3" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{CRITERIA_INFO.timeSensitivity.title} (1–5)</label>
            <select name="timeSensitivity" defaultValue="3" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Связь с текущей целью (1–5)</label>
            <select name="goalAlignment" defaultValue="3" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Затраты (минуты)</label>
            <input
              type="number"
              name="effortMinutes"
              step="5"
              min="5"
              defaultValue="30"
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Дедлайн (необязательно)</label>
            <input
              type="date"
              name="deadline"
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm mb-1.5">
              <input type="checkbox" name="financialConsequence" />
              Есть финансовые последствия
            </label>
          </div>
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
          Добавить задачу
        </button>
      </form>
    </div>
  );
}
