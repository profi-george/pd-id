import { tg, BOT_COMMANDS, BOT_DESCRIPTION, BOT_SHORT_DESCRIPTION } from "@/lib/telegramBot";

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
  const [commands, description, shortDescription, menuButton, me] = await Promise.all([
    tg("setMyCommands", { commands: BOT_COMMANDS }),
    tg("setMyDescription", { description: BOT_DESCRIPTION }),
    tg("setMyShortDescription", { short_description: BOT_SHORT_DESCRIPTION }),
    tg("setChatMenuButton", { menu_button: { type: "commands" } }),
    tg("getMe", {}),
  ]);
  return Response.json({
    url,
    setWebhook: result,
    commands,
    description,
    shortDescription,
    menuButton,
    bot: (me.result as { username?: string } | undefined)?.username,
  });
}
