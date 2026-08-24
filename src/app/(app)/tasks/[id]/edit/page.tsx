import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateTask } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { toDateInputValue } from "@/lib/dates";
import PriorityTag from "@/components/PriorityTag";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCALE = [1, 2, 3, 4, 5];

export default async function EditTaskPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  const { returnTo } = await searchParams;
  const [task, projects] = await Promise.all([
    prisma.task.findFirst({ where: { id, userId: user.id } }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  if (!task) notFound();

  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Изменить задачу</h1>
        <PriorityTag task={task} />
      </div>

      {(task.primaryReason || task.riskText) && (
        <div className="text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5 space-y-0.5">
          {task.primaryReason && <p>Почему: {task.primaryReason}</p>}
          {task.riskText && <p>Риск отложить: {task.riskText}</p>}
        </div>
      )}

      <form
        action={updateTask.bind(null, id)}
        className="space-y-4 bg-white border border-neutral-200 rounded-lg p-4"
      >
        <input type="hidden" name="returnTo" value={returnTo ?? "/backlog"} />

        <div>
          <label className="block text-sm font-medium mb-1">Формулировка задачи</label>
          <textarea
            name="text"
            required
            rows={2}
            defaultValue={task.text}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
          <p className="mt-1 text-xs text-neutral-500 bg-neutral-50 border border-neutral-200 rounded px-2 py-1.5">
            Памятка: формулируйте конкретно, через результат действия, а не поверхностно. Плохо:
            «поработать над проектом». Хорошо: «отправить клиенту согласованную смету».
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ожидаемый результат</label>
          <input
            name="resultText"
            defaultValue={task.resultText ?? ""}
            className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Проект</label>
          <select
            name="projectId"
            defaultValue={task.projectId ?? ""}
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
            <label className="block text-sm font-medium mb-1">Impact / Влияние (1–5)</label>
            <select name="value" defaultValue={String(task.value)} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cost of Delay / Цена откладывания (1–5)</label>
            <select name="costOfDelay" defaultValue={String(task.costOfDelay)} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Time Sensitivity (1–5)</label>
            <select name="timeSensitivity" defaultValue={String(task.timeSensitivity)} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Связь с текущей целью (1–5)</label>
            <select name="goalAlignment" defaultValue={String(task.goalAlignment)} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
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
              defaultValue={task.effortMinutes}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Дедлайн</label>
            <input
              type="date"
              name="deadline"
              defaultValue={task.deadline ? toDateInputValue(task.deadline) : ""}
              className="w-full border border-neutral-300 rounded px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-sm mb-1.5">
              <input type="checkbox" name="financialConsequence" defaultChecked={task.financialConsequence} />
              Есть финансовые последствия
            </label>
          </div>
        </div>

        <button
          type="submit"
          className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
        >
          Сохранить изменения
        </button>
      </form>
    </div>
  );
}
