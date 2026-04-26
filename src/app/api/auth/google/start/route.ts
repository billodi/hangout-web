export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";

const STATE_COOKIE = "hangout_google_oauth_state";

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

export async function GET(req: Request) {
  const config = getGoogleConfig();
  if (!config) {
    return Response.redirect(new URL("/?auth_error=google_not_configured", req.url), 302);
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 10 * 60,
  });

  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`, 302);
}
