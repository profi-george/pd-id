import { getGoogleStatus, disconnectGoogleAction, getCycleSettings, setCycleSettings, markCycleStartToday } from "@/app/(app)/actions";
import { todayDate, toDateInputValue } from "@/lib/dates";
import { getCycleInfo, DEFAULT_CYCLE_LENGTH, DEFAULT_PERIOD_LENGTH } from "@/lib/cycle";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const [status, cycle] = await Promise.all([getGoogleStatus(), getCycleSettings()]);
  const cyclePreview = cycle.cycleStartDate
    ? getCycleInfo(cycle.cycleStartDate, todayDate(), cycle.cycleLengthDays ?? undefined, cycle.periodLengthDays ?? undefined)
    : null;

  return (
    <div className="space-y-7 max-w-lg">
      <h1 className="text-[26px] leading-tight font-display font-bold text-neutral-900">Настройки</h1>

      {connected && (
        <p className="text-sm text-emerald-800 bg-emerald-50 ring-1 ring-emerald-200 rounded-xl px-3.5 py-2.5">
          Google-календарь подключён.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 ring-1 ring-red-200 rounded-xl px-3.5 py-2.5">{error}</p>
      )}

      <div className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Google-календарь</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Подключите, чтобы добавлять задачи прямо в свой календарь — событие появится
          в приложении Google Calendar на вашем телефоне и компьютере.
        </p>

        {status.connected ? (
          <div className="space-y-2">
            <p className="text-sm text-neutral-700">
              Подключено{status.email ? ` как ${status.email}` : ""}.
            </p>
            <form action={disconnectGoogleAction}>
              <button
                type="submit"
                className="btn btn-secondary !text-red-600 hover:!text-red-700"
              >
                Отключить
              </button>
            </form>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="btn btn-primary"
          >
            Подключить Google-календарь
          </a>
        )}
      </div>

      <div className="surface p-5 space-y-3">
        <h2 className="text-sm font-semibold text-neutral-900">Календарь цикла</h2>
        <p className="text-sm text-neutral-500 leading-relaxed">
          Дата начала последней менструации — дальше день цикла и фаза (овуляция, ПМС)
          считаются сами и подставляются в «Итог дня». Оценка примерная, не диагноз.
        </p>

        {cyclePreview && (
          <p className="text-sm text-ink-700 bg-ink-50 ring-1 ring-ink-200 rounded-xl px-3.5 py-2.5">
            Сегодня — день цикла {cyclePreview.day} · {cyclePreview.phaseLabel}
          </p>
        )}

        <form action={setCycleSettings} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-neutral-600 mb-1.5">Дата начала последнего цикла</label>
            <input
              type="date"
              name="cycleStartDate"
              defaultValue={cycle.cycleStartDate ? toDateInputValue(cycle.cycleStartDate) : ""}
              className="field max-w-[12rem]"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Длина цикла, дней</label>
              <input
                type="number"
                name="cycleLengthDays"
                min={15}
                max={45}
                placeholder={String(DEFAULT_CYCLE_LENGTH)}
                defaultValue={cycle.cycleLengthDays ?? ""}
                className="field w-24"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-600 mb-1.5">Длина менструации, дней</label>
              <input
                type="number"
                name="periodLengthDays"
                min={1}
                max={10}
                placeholder={String(DEFAULT_PERIOD_LENGTH)}
                defaultValue={cycle.periodLengthDays ?? ""}
                className="field w-24"
              />
            </div>
          </div>
          <button type="submit" className="btn btn-primary">
            Сохранить
          </button>
        </form>

        <form action={markCycleStartToday}>
          <button type="submit" className="btn btn-secondary">
            Цикл начался сегодня
          </button>
        </form>
      </div>
    </div>
  );
}
