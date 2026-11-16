import { tg } from "@/lib/telegramBot";

// Подключает webhook бота к этому сайту. Вызывается вручную один раз после
// деплоя (с сервера Vercel — из России api.telegram.org может не открываться):
//   curl -X POST https://<сайт>/api/telegram/setup -H "x-setup-secret: <TELEGRAM_WEBHOOK_SECRET>"
export async function POST(req: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-setup-secret") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const url = `${new URL(req.url).origin}/api/telegram/webhook`;
  const result = await tg("setWebhook", {
    url,
    secret_token: secret,
    allowed_updates: ["message"],
    drop_pending_updates: true,
  });
  const me = await tg("getMe", {});
  return Response.json({ url, setWebhook: result, bot: (me.result as { username?: string } | undefined)?.username });
}
