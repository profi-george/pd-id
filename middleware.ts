import { NextResponse, type NextRequest } from "next/server";

const COOKIE_NAME = "pd_id_session";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  const hasSession = Boolean(req.cookies.get(COOKIE_NAME)?.value);
  if (!hasSession) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/google/callback|_next/static|_next/image|favicon.ico).*)"],
};
