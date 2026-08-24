import { prisma } from "@/lib/prisma";
import { TaskStatus } from "@/generated/prisma/client";
import { todayDate, formatDateHuman, toDateInputValue } from "@/lib/dates";
import { submitEveningForm } from "@/app/actions";
import PriorityTag from "@/components/PriorityTag";

export const dynamic = "force-dynamic";

const SCALE_10 = Array.from({ length: 11 }, (_, i) => i);

export default async function EveningSummaryPage() {
  const date = todayDate();
  const tasks = await prisma.task.findMany({
    where: { date, status: TaskStatus.PLANNED },
    include: { project: true },
    orderBy: { order: "asc" },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Итог дня</h1>
        <p className="text-sm text-neutral-500">{formatDateHuman(date)}</p>
      </div>

      <form action={submitEveningForm} className="space-y-6">
        <input type="hidden" name="date" value={toDateInputValue(date)} />

        {tasks.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-sm font-medium text-neutral-600">Оценка задач</h2>
            {tasks.map((t) => (
              <div key={t.id} className="bg-white border border-neutral-200 rounded-lg px-3 py-2 space-y-2">
                <p className="text-sm">{t.text}</p>
                <div className="flex items-center gap-2 text-xs text-neutral-500">
                  {t.project ? <span>{t.project.name}</span> : null}
                  <PriorityTag task={t} />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name={`done_${t.id}`} defaultChecked />
                    Выполнена
                  </label>
                  <label className="flex items-center gap-1.5 text-sm">
                    Оценка
                    <select
                      name={`score_${t.id}`}
                      defaultValue=""
                      className="border border-neutral-300 rounded px-1 py-0.5 text-sm"
                    >
                      <option value="">—</option>
                      {SCALE_10.map((n) => (
                        <option key={n} value={n}>{n}</option>
                      ))}
                    </select>
                    /10
                  </label>
                </div>
              </div>
            ))}
          </div>
        )}
        {tasks.length === 0 && (
          <p className="text-sm text-neutral-400">На сегодня не было запланированных задач.</p>
        )}

        <div className="space-y-3 bg-white border border-neutral-200 rounded-lg p-3">
          <h2 className="text-sm font-medium text-neutral-600">Рефлексия</h2>
          <div>
            <label className="block text-sm font-medium mb-1">Почему получилось</label>
            <textarea name="whyWorked" rows={2} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Почему не получилось</label>
            <textarea name="whyNotWorked" rows={2} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 bg-white border border-neutral-200 rounded-lg p-3">
          <h2 className="text-sm font-medium text-neutral-600 col-span-2">Метрики дня (1–10)</h2>
          {[
            ["difficulty", "Трудность"],
            ["mood", "Настроение"],
            ["efficiency", "Эффективность"],
            ["worry", "Переживания"],
          ].map(([name, label]) => (
            <div key={name}>
              <label className="block text-sm font-medium mb-1">{label}</label>
              <select name={name} defaultValue="5" className="w-full border border-neutral-300 rounded px-2 py-1 text-sm">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
          ))}
        </div>

        <div className="bg-white border border-neutral-200 rounded-lg p-3">
          <label className="block text-sm font-medium mb-1">Вывод на завтра</label>
          <textarea name="conclusion" rows={2} className="w-full border border-neutral-300 rounded px-2 py-1 text-sm" />
        </div>

        <button
          type="submit"
          className="w-full text-sm px-3 py-2 rounded bg-neutral-800 text-white hover:bg-neutral-700"
        >
          Сохранить итог и сформировать план на завтра
        </button>
      </form>
    </div>
  );
}
