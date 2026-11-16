import { after } from "next/server";
import { handleTelegramUpdate } from "@/lib/telegramBot";

// Разбор ИИ может идти до минуты — Telegram столько не ждёт и шлёт сообщение
// повторно. Поэтому сразу отвечаем 200, а обработку доделываем в after().
export const maxDuration = 60;

export async function POST(req: Request) {
  // Секрет из setWebhook — без него любой мог бы слать сюда поддельные сообщения.
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!secret || req.headers.get("x-telegram-bot-api-secret-token") !== secret) {
    return new Response("forbidden", { status: 403 });
  }
  const update = await req.json();
  after(() => handleTelegramUpdate(update).catch((e) => console.error("telegram update failed", e)));
  return Response.json({ ok: true });
}
