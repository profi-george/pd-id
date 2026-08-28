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
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-display font-bold">Настройки</h1>

      {connected && (
        <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
          Google-календарь подключён.
        </p>
      )}
      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium">Google-календарь</h2>
        <p className="text-sm text-neutral-500">
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
                className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50 text-red-600"
              >
                Отключить
              </button>
            </form>
          </div>
        ) : (
          <a
            href="/api/google/connect"
            className="inline-block text-sm px-3 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700"
          >
            Подключить Google-календарь
          </a>
        )}
      </div>

      <div className="bg-white border border-neutral-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-medium">Календарь цикла</h2>
        <p className="text-sm text-neutral-500">
          Дата начала последней менструации — дальше день цикла и фаза (овуляция, ПМС)
          считаются сами и подставляются в «Итог дня». Оценка примерная, не диагноз.
        </p>

        {cyclePreview && (
          <p className="text-sm text-ink-700 bg-ink-50 border border-ink-200 rounded-lg px-3 py-2">
            Сегодня — день цикла {cyclePreview.day} · {cyclePreview.phaseLabel}
          </p>
        )}

        <form action={setCycleSettings} className="space-y-3">
          <div>
            <label className="block text-xs text-neutral-500 mb-1">Дата начала последнего цикла</label>
            <input
              type="date"
              name="cycleStartDate"
              defaultValue={cycle.cycleStartDate ? toDateInputValue(cycle.cycleStartDate) : ""}
              className="border border-neutral-300 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div className="flex gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Длина цикла, дней</label>
              <input
                type="number"
                name="cycleLengthDays"
                min={15}
                max={45}
                placeholder={String(DEFAULT_CYCLE_LENGTH)}
                defaultValue={cycle.cycleLengthDays ?? ""}
                className="w-24 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1">Длина менструации, дней</label>
              <input
                type="number"
                name="periodLengthDays"
                min={1}
                max={10}
                placeholder={String(DEFAULT_PERIOD_LENGTH)}
                defaultValue={cycle.periodLengthDays ?? ""}
                className="w-24 border border-neutral-300 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button type="submit" className="text-sm px-3 py-1.5 rounded bg-neutral-800 text-white hover:bg-neutral-700">
            Сохранить
          </button>
        </form>

        <form action={markCycleStartToday}>
          <button type="submit" className="text-sm px-3 py-1.5 rounded border border-neutral-300 hover:bg-neutral-50">
            Цикл начался сегодня
          </button>
        </form>
      </div>
    </div>
  );
}
