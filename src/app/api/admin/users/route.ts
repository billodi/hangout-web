export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { getDb } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { eq } from "drizzle-orm";

type Action = "ban" | "unban" | "set_role" | "delete";

export async function POST(req: Request) {
  const currentUser = await getCurrentUser();
  
  if (!currentUser || (currentUser.role !== "admin" && currentUser.role !== "owner")) {
    return Response.json({ error: "Admin access required" }, { status: 403 });
  }

  const db = getDb();
  let body: { action: Action; userId?: string; role?: string };
  
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { action, userId, role } = body;

  // Prevent self-modification
  if (userId && userId === currentUser.id) {
    return Response.json({ error: "Cannot modify your own account" }, { status: 400 });
  }

  // Only owners can modify admins
  if (currentUser.role !== "owner" && userId) {
    const [targetUser] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId));
    
    if (targetUser?.role === "owner") {
      return Response.json({ error: "Only owners can modify other owners" }, { status: 403 });
    }
  }

  switch (action) {
    case "ban": {
      if (!userId) {
        return Response.json({ error: "userId is required" }, { status: 400 });
      }
      // Set role to 'banned' (invisible role)
      await db
        .update(users)
        .set({ role: "banned" })
        .where(eq(users.id, userId));
      return Response.json({ success: true, message: "User banned" });
    }

    case "unban": {
      if (!userId) {
        return Response.json({ error: "userId is required" }, { status: 400 });
      }
      await db
        .update(users)
        .set({ role: "user" })
        .where(eq(users.id, userId));
      return Response.json({ success: true, message: "User unbanned" });
    }

    case "set_role": {
      if (!userId) {
        return Response.json({ error: "userId is required" }, { status: 400 });
      }
      if (!role || !["user", "moderator", "admin", "owner"].includes(role)) {
        return Response.json({ error: "Invalid role" }, { status: 400 });
      }
      
      // Only owners can set owner role
      if (role === "owner" && currentUser.role !== "owner") {
        return Response.json({ error: "Only owners can assign owner role" }, { status: 403 });
      }

      const isAdmin = role === "admin" || role === "owner" ? 1 : 0;
      
      await db
        .update(users)
        .set({ role, isAdmin })
        .where(eq(users.id, userId));
      
      return Response.json({ success: true, message: `Role set to ${role}` });
    }

    case "delete": {
      if (!userId) {
        return Response.json({ error: "userId is required" }, { status: 400 });
      }
      // Hard delete user and all their data
      await db.delete(users).where(eq(users.id, userId));
      return Response.json({ success: true, message: "User deleted" });
    }

    default:
      return Response.json({ error: "Invalid action" }, { status: 400 });
  }
}
