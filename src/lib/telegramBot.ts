// Telegram-бот ПД-ИД: принимает задачи текстом и раскладывает их тем же ИИ,
// что и страница добавления. Сообщения приходят через webhook
// (app/api/telegram/webhook), отвечаем обычным текстом без разметки.

import { prisma } from "@/lib/prisma";
import { chatWithAI, friendlyAiError, type ChatMessage } from "@/lib/ai";
import { assignBuckets, bucketForDate, toPlannedTasks, type PlannedTask } from "@/lib/buckets";
import { saveAiTasks } from "@/lib/taskSave";
import { todayDate, toDateInputValue, parseDateInputValue } from "@/lib/dates";

type TgUpdate = {
  update_id: number;
  message?: {
    text?: string;
    voice?: unknown;
    chat: { id: number; type: string };
  };
};

export async function tg(method: string, body: object) {
  const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await res.json()) as { ok: boolean; result?: unknown; description?: string };
}

function reply(chatId: string, text: string) {
  return tg("sendMessage", { chat_id: chatId, text, disable_web_page_preview: true });
}

const NOT_LINKED =
  "Этот чат пока не подключён к ПД-ИД. Откройте в кабинете «Настройки» → «Подключить Telegram» — после этого просто пишите сюда задачи.";

export const HELP = [
  "Как пользоваться:",
  "",
  "Просто напишите задачи обычным сообщением — одну или списком, как в голове. Я разложу их на сегодня, завтра, на неделю, «потом» или на дату, если вы её назвали, и сохраню в кабинет ПД-ИД.",
  "",
  "Например:",
  "завтра отправить счёт клиенту",
  "до 25.11 сдать отчёт",
  "записаться к врачу, разобрать фото",
  "",
  "Если что-то непонятно — я переспрошу, ответьте прямо здесь.",
  "",
  "Меню (кнопка слева от поля ввода):",
  "/help — эта подсказка",
  "/cancel — сбросить незаконченный разговор",
].join("\n");

// Меню команд и описание бота — ставятся из /api/telegram/setup.
export const BOT_COMMANDS = [
  { command: "help", description: "Как пользоваться" },
  { command: "cancel", description: "Сбросить незаконченный разговор" },
];
export const BOT_SHORT_DESCRIPTION = "Пишите задачи — бот разложит их по дням и сохранит в ПД-ИД.";
export const BOT_DESCRIPTION =
  "Бот ПД-ИД. Пишите задачи как в голове — одну или списком. Бот поймёт, когда их делать (сегодня, завтра, на неделе, потом или в названную дату), и сохранит в ваш кабинет.\n\nПодключение: ПД-ИД → Настройки → «Подключить Telegram».";

function whenLabel(t: PlannedTask, todayISO: string): string {
  if (t.scheduledDate) {
    const b = bucketForDate(t.scheduledDate, todayISO);
    if (b === "today") return "сегодня";
    if (b === "tomorrow") return "завтра";
    return parseDateInputValue(t.scheduledDate).toLocaleDateString("ru-RU", {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });
  }
  return t.bucket === "later" ? "потом" : "на неделе";
}

async function linkChat(chatId: string, token: string | undefined) {
  if (!token) {
    const linked = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    return reply(chatId, linked ? HELP : NOT_LINKED);
  }
  const user = await prisma.user.findUnique({ where: { telegramLinkToken: token } });
  if (!user) {
    return reply(chatId, "Ссылка устарела. Нажмите «Подключить Telegram» в настройках ПД-ИД ещё раз.");
  }
  // Один чат — один кабинет: если этот чат был привязан к другому кабинету, отвязываем.
  await prisma.user.updateMany({ where: { telegramChatId: chatId, NOT: { id: user.id } }, data: { telegramChatId: null } });
  await prisma.user.update({
    where: { id: user.id },
    data: { telegramChatId: chatId, telegramLinkToken: null, telegramHistory: null },
  });
  return reply(chatId, `Готово, бот подключён к кабинету «${user.name}».\n\n${HELP}`);
}

export async function handleTelegramUpdate(update: TgUpdate) {
  const msg = update.message;
  // Только личный чат: в группе задачи мог бы добавлять кто угодно из участников.
  if (!msg || msg.chat.type !== "private") return;
  const chatId = String(msg.chat.id);
  const text = msg.text?.trim() ?? "";

  if (text.startsWith("/start")) return linkChat(chatId, text.split(/\s+/)[1]);

  const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
  if (!user) return reply(chatId, NOT_LINKED);

  // Telegram повторяет доставку, если ответ задержался, — без этой проверки
  // одна и та же задача сохранялась бы дважды.
  const claimed = await prisma.user.updateMany({
    where: {
      id: user.id,
      OR: [{ telegramLastUpdateId: null }, { telegramLastUpdateId: { lt: update.update_id } }],
    },
    data: { telegramLastUpdateId: update.update_id },
  });
  if (claimed.count === 0) return;

  if (!text) {
    return reply(chatId, msg.voice ? "Голосовые пока не понимаю — напишите, пожалуйста, текстом." : HELP);
  }
  if (text === "/help") return reply(chatId, HELP);
  if (text === "/cancel" || /^отмена$/i.test(text)) {
    await prisma.user.update({ where: { id: user.id }, data: { telegramHistory: null } });
    return reply(chatId, "Сброшено. Пишите задачи заново.");
  }

  let history: ChatMessage[] = [];
  try {
    history = user.telegramHistory ? (JSON.parse(user.telegramHistory) as ChatMessage[]) : [];
  } catch {}

  await tg("sendChatAction", { chat_id: chatId, action: "typing" });

  try {
    const [settings, projects] = await Promise.all([
      prisma.appSettings.findUnique({ where: { userId: user.id } }),
      prisma.project.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    ]);
    const result = await chatWithAI(history, text, {
      currentGoal: settings?.currentGoal ?? null,
      today: new Date(),
      projects,
    });

    if (!result.done) {
      const next: ChatMessage[] = [...history, { role: "user", text }, { role: "assistant", text: result.question }];
      await prisma.user.update({ where: { id: user.id }, data: { telegramHistory: JSON.stringify(next) } });
      return reply(chatId, result.question);
    }

    const todayISO = toDateInputValue(todayDate());
    const tasks = toPlannedTasks(assignBuckets(result.tasks, todayISO));
    await saveAiTasks(user.id, tasks);
    await prisma.user.update({ where: { id: user.id }, data: { telegramHistory: null } });

    const lines = tasks.map((t) => `• ${t.text} — ${whenLabel(t, todayISO)}`);
    return reply(chatId, `Добавлено:\n${lines.join("\n")}`);
  } catch (e) {
    return reply(chatId, `${friendlyAiError(e)}\nСообщение не сохранено — отправьте его ещё раз.`);
  }
}
