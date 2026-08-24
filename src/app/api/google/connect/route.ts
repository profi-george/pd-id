import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleCalendar";

export async function GET(request: NextRequest) {
  try {
    return NextResponse.redirect(getGoogleAuthUrl());
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, request.url));
  }
}
