"use server";

import { randomBytes } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { tg } from "@/lib/telegramBot";

async function botUsername(): Promise<string | null> {
  if (process.env.TELEGRAM_BOT_USERNAME) return process.env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  const me = await tg("getMe", {});
  return (me.result as { username?: string } | undefined)?.username ?? null;
}

export async function getTelegramStatus() {
  const user = await requireUser();
  const row = await prisma.user.findUnique({ where: { id: user.id }, select: { telegramChatId: true } });
  return { connected: Boolean(row?.telegramChatId), configured: Boolean(process.env.TELEGRAM_BOT_TOKEN) };
}

// Одноразовый код в ссылке t.me/<бот>?start=<код>: бот по нему узнаёт, к
// какому кабинету привязать чат, и сразу стирает код.
export async function connectTelegram() {
  const user = await requireUser();
  const username = await botUsername();
  if (!username) redirect("/settings?error=" + encodeURIComponent("Бот ещё не настроен: нет TELEGRAM_BOT_TOKEN."));
  const token = randomBytes(16).toString("hex");
  await prisma.user.update({ where: { id: user.id }, data: { telegramLinkToken: token } });
  redirect(`https://t.me/${username}?start=${token}`);
}

export async function disconnectTelegram() {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: null, telegramLinkToken: null, telegramHistory: null },
  });
  revalidatePath("/settings");
}
