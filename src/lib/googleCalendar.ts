// Минимальная обёртка над Google OAuth 2.0 + Calendar API. Без библиотек — только fetch,
// чтобы не тащить googleapis (тяжёлая зависимость) ради одного эндпоинта "создать событие".

import { prisma } from "@/lib/prisma";

const SCOPE = "https://www.googleapis.com/auth/calendar.events openid email";
const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Не настроен ${name}. Добавьте его в файл .env (см. инструкцию в README/чате) и перезапустите сервер.`
    );
  }
  return value;
}

function getRedirectUri(): string {
  return process.env.GOOGLE_REDIRECT_URI || "http://localhost:3000/api/google/callback";
}

export function getGoogleAuthUrl(): string {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: SCOPE,
    access_type: "offline",
    prompt: "consent", // чтобы гарантированно получить refresh_token даже при повторном подключении
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string): Promise<void> {
  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google отклонил обмен кода на токен (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  const userRes = await fetch(USERINFO_URL, {
    headers: { Authorization: `Bearer ${data.access_token}` },
  });
  const user = userRes.ok ? ((await userRes.json()) as { email?: string }) : {};

  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: {
      id: "singleton",
      googleAccessToken: data.access_token,
      googleRefreshToken: data.refresh_token ?? null,
      googleTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      googleAccountEmail: user.email ?? null,
    },
    update: {
      googleAccessToken: data.access_token,
      // refresh_token приходит только при первом согласии (prompt=consent) —
      // не затираем старый, если Google в этот раз его не прислал.
      ...(data.refresh_token ? { googleRefreshToken: data.refresh_token } : {}),
      googleTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
      googleAccountEmail: user.email ?? null,
    },
  });
}

export async function getGoogleConnectionStatus(): Promise<{ connected: boolean; email: string | null }> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  return {
    connected: Boolean(settings?.googleRefreshToken),
    email: settings?.googleAccountEmail ?? null,
  };
}

export async function disconnectGoogle(): Promise<void> {
  await prisma.appSettings.upsert({
    where: { id: "singleton" },
    create: { id: "singleton" },
    update: {
      googleAccessToken: null,
      googleRefreshToken: null,
      googleTokenExpiry: null,
      googleAccountEmail: null,
    },
  });
}

async function getValidAccessToken(): Promise<string> {
  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });
  if (!settings?.googleRefreshToken) {
    throw new Error("Google-календарь не подключён. Подключите его в настройках.");
  }

  const stillValid =
    settings.googleAccessToken &&
    settings.googleTokenExpiry &&
    settings.googleTokenExpiry.getTime() - Date.now() > 60_000;

  if (stillValid) return settings.googleAccessToken!;

  const clientId = requireEnv("GOOGLE_CLIENT_ID");
  const clientSecret = requireEnv("GOOGLE_CLIENT_SECRET");

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: settings.googleRefreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Не удалось обновить токен Google (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { access_token: string; expires_in: number };

  await prisma.appSettings.update({
    where: { id: "singleton" },
    data: {
      googleAccessToken: data.access_token,
      googleTokenExpiry: new Date(Date.now() + data.expires_in * 1000),
    },
  });

  return data.access_token;
}

export async function createCalendarEvent(input: {
  title: string;
  description?: string;
  startISO: string; // ISO datetime, локальное время пользователя
  endISO: string;
}): Promise<{ eventId: string; eventUrl: string }> {
  const accessToken = await getValidAccessToken();

  const res = await fetch(EVENTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: input.title,
      description: input.description || undefined,
      start: { dateTime: input.startISO },
      end: { dateTime: input.endISO },
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Calendar вернул ошибку (${res.status}): ${body.slice(0, 300)}`);
  }

  const data = (await res.json()) as { id: string; htmlLink: string };
  return { eventId: data.id, eventUrl: data.htmlLink };
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const accessToken = await getValidAccessToken();
  await fetch(`${EVENTS_URL}/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
