import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, SESSION_COOKIE_PREFIX } from "@/lib/cookieNames";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const cookies = req.cookies.getAll();

  for (const cookie of cookies) {
    const name = cookie.name;
    if (name === SESSION_COOKIE) continue;

    if (name === LEGACY_SESSION_COOKIE || name.startsWith(SESSION_COOKIE_PREFIX)) {
      res.cookies.set(name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

