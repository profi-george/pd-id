import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/app/(app)/actions";
import { flattenProjectsForSelect } from "@/lib/projectTree";
import { CRITERIA_INFO } from "@/lib/criteriaInfo";
import { PRIORITY_LABEL_TEXT, isPriorityLabel } from "@/lib/priorityEngine";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SCALE = [1, 2, 3, 4, 5];

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; projectId?: string; priority?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;
  const dateOption = params.date === "today" || params.date === "tomorrow" ? params.date : "backlog";
  const presetPriority = isPriorityLabel(params.priority) ? params.priority : null;
  const projects = await prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const projectOptions = flattenProjectsForSelect(
    projects.map((p) => ({ id: p.id, name: p.name, parentId: p.parentId }))
  );

  const aiHref = "/add";
  const bulkHref = `/tasks/bulk?date=${dateOption}${params.projectId ? `&projectId=${params.projectId}` : ""}`;

  return (
    <div className="space-y-5 max-w-2xl">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">Новая задача (вручную)</h1>
        <div className="flex gap-1.5 shrink-0">
          <Link href={aiHref} className="btn btn-secondary btn-sm">
            Пусть оценит ИИ
          </Link>
          <Link href={bulkHref} className="btn btn-secondary btn-sm">
            Несколько сразу
          </Link>
        </div>
      </div>
      <p className="text-xs text-neutral-500 leading-relaxed -mt-2">
        Обычно проще продиктовать задачу ИИ — он сам оценит критерии ниже. Эта форма для случаев,
        когда вы точно знаете оценки сами или нет доступа к ИИ.
      </p>

      <form action={createTask} className="surface space-y-5 p-5">
        {presetPriority && (
          <>
            <input type="hidden" name="priority" value={presetPriority} />
            <p className="text-xs text-ink-700 bg-ink-50 ring-1 ring-ink-100 rounded-lg px-3 py-2 leading-relaxed">
              Задача попадёт в группу приоритета «{PRIORITY_LABEL_TEXT[presetPriority]}» — как в квадранте матрицы, откуда вы её добавляете.
            </p>
          </>
        )}
        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Формулировка задачи</label>
          <textarea
            name="text"
            required
            rows={2}
            className="field resize-none"
            placeholder="Например: отправить черновик договора клиенту на согласование"
          />
          <p className="mt-2 text-xs text-neutral-600 bg-neutral-50 ring-1 ring-neutral-200 rounded-lg px-3 py-2 leading-relaxed">
            Памятка: формулируйте конкретно, через результат действия — что именно будет
            сделано/готово, а не поверхностно и не процессом. Плохо: «поработать над проектом».
            Хорошо: «отправить клиенту согласованную смету».
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Ожидаемый результат (необязательно)</label>
          <input
            name="resultText"
            className="field"
            placeholder="Что станет возможным/готовым после выполнения"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-neutral-900 mb-2">Проект</label>
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{CRITERIA_INFO.value.title} (1–5)</label>
            <select name="value" defaultValue="3" className="field">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{CRITERIA_INFO.costOfDelay.title} (1–5)</label>
            <select name="costOfDelay" defaultValue="3" className="field">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">{CRITERIA_INFO.timeSensitivity.title} (1–5)</label>
            <select name="timeSensitivity" defaultValue="3" className="field">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Связь с текущей целью (1–5)</label>
            <select name="goalAlignment" defaultValue="3" className="field">
              {SCALE.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Затраты (минуты)</label>
            <input
              type="number"
              name="effortMinutes"
              step="5"
              min="5"
              defaultValue="30"
              className="field"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1.5">Дедлайн (необязательно)</label>
            <input
              type="date"
              name="deadline"
              className="field"
            />
          </div>
          <div className="flex items-end">
            <label className="flex items-center gap-2 text-[13px] text-neutral-700 rounded-lg ring-1 ring-neutral-200 px-3 py-2.5 w-full hover:bg-neutral-50 transition-colors">
              <input type="checkbox" name="financialConsequence" />
              Есть финансовые последствия
            </label>
          </div>
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
          Добавить задачу
        </button>
      </form>
    </div>
  );
}
