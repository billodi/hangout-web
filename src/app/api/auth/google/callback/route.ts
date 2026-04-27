export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";

const STATE_COOKIE = "billixa_google_oauth_state";

type GoogleTokenResponse = {
  access_token?: string;
};

type GoogleUserInfo = {
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
};

function getGoogleConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return { clientId, clientSecret };
}

function cleanDisplayName(value: unknown): string {
  if (typeof value !== "string") return "Google User";
  const trimmed = value.trim();
  if (!trimmed) return "Google User";
  return trimmed.slice(0, 50);
}

function cleanAvatar(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 400);
}

function failureRedirect(req: Request, reason: string) {
  return Response.redirect(new URL(`/?auth_error=${encodeURIComponent(reason)}`, req.url), 302);
}

export async function GET(req: Request) {
  const config = getGoogleConfig();
  if (!config) return failureRedirect(req, "google_not_configured");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return failureRedirect(req, "google_missing_code");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.set(STATE_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
  if (!expectedState || expectedState !== state) {
    return failureRedirect(req, "google_invalid_state");
  }

  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    }),
    cache: "no-store",
  });

  if (!tokenRes.ok) return failureRedirect(req, "google_token_failed");
  const tokenData = (await tokenRes.json()) as GoogleTokenResponse;
  if (!tokenData.access_token) return failureRedirect(req, "google_token_missing");

  const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
    cache: "no-store",
  });
  if (!userRes.ok) return failureRedirect(req, "google_user_failed");
  const userInfo = (await userRes.json()) as GoogleUserInfo;

  const email = typeof userInfo.email === "string" ? userInfo.email.trim().toLowerCase() : "";
  if (!email || !userInfo.email_verified) return failureRedirect(req, "google_email_unverified");

  const db = getDb();
  const [existing] = await db.select().from(users).where(eq(users.email, email));

  const displayName = cleanDisplayName(userInfo.name ?? email.split("@")[0]);
  const avatarUrl = cleanAvatar(userInfo.picture);

  let userId: string;
  if (existing) {
    userId = existing.id;
    const needsName = !existing.displayName || existing.displayName === "Google User";
    const nextName = needsName ? displayName : existing.displayName;
    const nextAvatar = existing.avatarUrl || avatarUrl;
    if (nextName !== existing.displayName || nextAvatar !== existing.avatarUrl) {
      await db.update(users).set({ displayName: nextName, avatarUrl: nextAvatar }).where(eq(users.id, existing.id));
    }
  } else {
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash: hashPassword(randomBytes(32).toString("hex")),
        displayName,
        avatarUrl,
      })
      .returning({ id: users.id });
    userId = created.id;
  }

  const sessionId = await createSession(userId);
  await setSessionCookie(sessionId);
  return Response.redirect(new URL("/?auth_success=google", req.url), 302);
}
