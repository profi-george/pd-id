import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/googleCalendar";
import { getSessionUserId } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");
  const state = request.nextUrl.searchParams.get("state");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?error=Код+не+получен`, request.url));
  }

  // Кабинет, который подключает календарь, определяем по state (пережил редирект
  // на google.com и обратно) и сверяем с текущей сессией — иначе можно было бы
  // привязать чужой Google-аккаунт к чужому кабинету, подставив state вручную.
  const sessionUserId = await getSessionUserId();
  if (!state || !sessionUserId || state !== sessionUserId) {
    return NextResponse.redirect(new URL(`/login`, request.url));
  }

  try {
    await exchangeCodeForTokens(sessionUserId, code);
    return NextResponse.redirect(new URL("/settings?connected=1", request.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, request.url));
  }
}
