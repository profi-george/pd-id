import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens } from "@/lib/googleCalendar";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const oauthError = request.nextUrl.searchParams.get("error");

  if (oauthError) {
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(oauthError)}`, request.url));
  }
  if (!code) {
    return NextResponse.redirect(new URL(`/settings?error=Код+не+получен`, request.url));
  }

  try {
    await exchangeCodeForTokens(code);
    return NextResponse.redirect(new URL("/settings?connected=1", request.url));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, request.url));
  }
}
