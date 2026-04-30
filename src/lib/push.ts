import webpush from "web-push";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { eq } from "drizzle-orm";

type PushPayload = {
  title: string;
  body: string;
  href?: string | null;
};

let configured = false;
let configError: string | null = null;

function configureOnce() {
  if (configured) return;
  configured = true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT ?? "mailto:admin@example.com";

  if (!publicKey || !privateKey) {
    configError = "Missing VAPID keys";
    return;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
}

export function pushConfigured(): boolean {
  configureOnce();
  return !configError;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  configureOnce();
  if (configError) return;

  const db = getDb();
  const subs = await db
    .select({
      id: pushSubscriptions.id,
      endpoint: pushSubscriptions.endpoint,
      p256dh: pushSubscriptions.p256dh,
      auth: pushSubscriptions.auth,
    })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));

  const body = JSON.stringify(payload);

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        body,
      );
    } catch {
      // If the subscription is no longer valid, best-effort delete.
      await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id));
    }
  }
}

