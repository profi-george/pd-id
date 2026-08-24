import { getGoogleStatus, disconnectGoogleAction } from "@/app/actions";

export const dynamic = "force-dynamic";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ connected?: string; error?: string }>;
}) {
  const { connected, error } = await searchParams;
  const status = await getGoogleStatus();

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-xl font-semibold">Настройки</h1>

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
    </div>
  );
}
