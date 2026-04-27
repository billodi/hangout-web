import { NextResponse, type NextRequest } from "next/server";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, SESSION_COOKIE_PREFIX } from "@/lib/cookieNames";

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  const cookies = req.cookies.getAll();
  const hasActiveCookie = cookies.some((cookie) => cookie.name === SESSION_COOKIE);

  for (const cookie of cookies) {
    const name = cookie.name;
    if (name === SESSION_COOKIE) continue;

    // Always clear the old fixed-name cookie.
    if (name === LEGACY_SESSION_COOKIE) {
      res.cookies.set(name, "", {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 0,
      });
      continue;
    }

    // Only clear versioned cookies when we can see the active cookie in this runtime.
    // This avoids accidental sign-outs if Edge and Node resolve different deploy tags.
    if (name.startsWith(SESSION_COOKIE_PREFIX) && hasActiveCookie) {
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
