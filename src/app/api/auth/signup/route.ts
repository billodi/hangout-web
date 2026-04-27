export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { createSession, hashPassword, setSessionCookie } from "@/lib/auth";
import { eq } from "drizzle-orm";

type SignupPayload = {
  email?: unknown;
  password?: unknown;
  displayName?: unknown;
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

function cleanDisplayName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  if (!name || name.length > 50) return null;
  return name;
}

export async function POST(req: Request) {
  let body: SignupPayload;
  try {
    body = (await req.json()) as SignupPayload;
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const email = cleanEmail(body.email);
  const password = cleanPassword(body.password);
  const displayName = cleanDisplayName(body.displayName);
  if (!email || !password || !displayName) {
    return Response.json({ error: "Invalid signup fields" }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
  if (existing) {
    return Response.json({ error: "Email already in use" }, { status: 409 });
  }

  const [created] = await db
    .insert(users)
    .values({
      email,
      passwordHash: hashPassword(password),
      displayName,
    })
    .returning({
      id: users.id,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    });

  const sessionId = await createSession(created.id);
  await setSessionCookie(sessionId);

  return Response.json({ user: created }, { status: 201 });
}
