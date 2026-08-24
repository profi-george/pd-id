import { NextRequest, NextResponse } from "next/server";
import { getGoogleAuthUrl } from "@/lib/googleCalendar";
import { requireUser } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    return NextResponse.redirect(getGoogleAuthUrl(user.id));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Неизвестная ошибка";
    return NextResponse.redirect(new URL(`/settings?error=${encodeURIComponent(message)}`, request.url));
  }
}
