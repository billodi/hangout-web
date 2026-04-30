import { getDb } from "@/db";
import { notificationType, notifications } from "@/db/schema";
import { sendPushToUser } from "@/lib/push";

export type CreateNotificationInput = {
  userId: string;
  type: (typeof notificationType.enumValues)[number];
  title: string;
  body: string;
  href?: string | null;
  data?: unknown;
  push?: boolean;
};

export async function createNotification(input: CreateNotificationInput) {
  const db = getDb();
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      href: input.href ?? null,
      data: input.data ?? null,
    })
    .returning();

  if (input.push) {
    void sendPushToUser(input.userId, { title: input.title, body: input.body, href: input.href });
  }

  return row;
}

