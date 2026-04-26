export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, setSessionCookie, verifyPassword } from "@/lib/auth";
import { eq } from "drizzle-orm";

type LoginPayload = {
  email?: unknown;
  password?: unknown;
};

function cleanEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email || !email.includes("@") || email.length > 160) return null;
  return email;
}

function cleanPassword(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const password = value.trim();
  if (password.length < 6 || password.length > 100) return null;
  return password;
}

export async function POST(req: Request) {
  let body: LoginPayload;
  try {
    body = (await req.json()) as LoginPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  if (!email || !password) {
    return Response.json({ error: "Invalid credentials" }, { status: 400 });
  }

  const db = getDb();
  const [found] = await db.select().from(users).where(eq(users.email, email));
  if (!found || !verifyPassword(password, found.passwordHash)) {
    return Response.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const sessionId = await createSession(found.id);
  await setSessionCookie(sessionId);

  return Response.json({
    user: {
      id: found.id,
      email: found.email,
      displayName: found.displayName,
      bio: found.bio,
      avatarUrl: found.avatarUrl,
      createdAt: found.createdAt,
    },
  });
}
