import { cookies } from "next/headers";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { and, eq, gt, or } from "drizzle-orm";
import { getDb } from "@/db";
import { blocks, sessions, users } from "@/db/schema";
import { SESSION_COOKIE } from "@/lib/cookieNames";
const SESSION_TTL_DAYS = 30;

function toHex(bytes: Buffer): string {
  return bytes.toString("hex");
}

function fromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${toHex(salt)}:${toHex(hash as Buffer)}`;
}

export function verifyPassword(password: string, hashed: string): boolean {
  const [saltHex, hashHex] = hashed.split(":");
  if (!saltHex || !hashHex) return false;
  const salt = fromHex(saltHex);
  const expected = fromHex(hashHex);
  const actual = scryptSync(password, salt, expected.length);
  return timingSafeEqual(expected, actual as Buffer);
}

function getSessionExpiry(): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + SESSION_TTL_DAYS);
  return expiry;
}

export async function createSession(userId: string): Promise<string> {
  const db = getDb();
  const expiresAt = getSessionExpiry().toISOString();
  const [created] = await db.insert(sessions).values({ userId, expiresAt }).returning();
  return created.id;
}

export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export type AuthedUser = {
  id: string;
  email: string;
  displayName: string;
  bio: string;
  avatarUrl: string | null;
  isAdmin: number;
  role: string;
  createdAt: string;
};

export async function getCurrentUser(): Promise<AuthedUser | null> {
  const cookieStore = await cookies();
  const sessionId = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionId) return null;

  const db = getDb();
  const nowIso = new Date().toISOString();
  const [row] = await db
    .select({
      sessionId: sessions.id,
      userId: users.id,
      email: users.email,
      displayName: users.displayName,
      bio: users.bio,
      avatarUrl: users.avatarUrl,
      isAdmin: users.isAdmin,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, nowIso)));

  if (!row) return null;

  return {
    id: row.userId,
    email: row.email,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: row.avatarUrl,
    isAdmin: row.isAdmin,
    role: row.role,
    createdAt: row.createdAt,
  };
}

export async function deleteSession(sessionId: string) {
  const db = getDb();
  await db.delete(sessions).where(eq(sessions.id, sessionId));
}

export async function getCurrentSessionId(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(SESSION_COOKIE)?.value ?? null;
}

export function isStaff(user: AuthedUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "moderator" || user.role === "admin" || user.role === "owner";
}

export async function requireUser(): Promise<AuthedUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Unauthorized");
  return user;
}

export async function requireAdmin(): Promise<AuthedUser> {
  const user = await requireUser();
  if (!isStaff(user)) throw new Error("Forbidden");
  return user;
}

export async function isBlockedBetween(userAId: string, userBId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db
    .select({ id: blocks.id })
    .from(blocks)
    .where(
      or(
        and(eq(blocks.blockerId, userAId), eq(blocks.blockedId, userBId)),
        and(eq(blocks.blockerId, userBId), eq(blocks.blockedId, userAId)),
      ),
    )
    .limit(1);
  return !!row;
}

export async function requireNotBlockedBetween(userAId: string, userBId: string) {
  if (await isBlockedBetween(userAId, userBId)) throw new Error("Blocked");
}
