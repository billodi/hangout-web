export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireUser } from "@/lib/auth";
import { getStorageBucket, getSupabaseAdmin } from "@/lib/supabaseAdmin";

function safeExt(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".png")) return "png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (lower.endsWith(".webp")) return "webp";
  return "bin";
}

export async function POST(req: Request) {
  const user = await requireUser();
  let fd: FormData;
  try {
    fd = await req.formData();
  } catch {
    return Response.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = fd.get("file");
  if (!(file instanceof File)) return Response.json({ error: "File required" }, { status: 400 });
  if (file.size <= 0 || file.size > 8_000_000) return Response.json({ error: "File too large" }, { status: 400 });

  let sb;
  try {
    sb = getSupabaseAdmin();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Supabase not configured" }, { status: 503 });
  }

  const ext = safeExt(file.name);
  const bucket = getStorageBucket();
  const path = `diary/${user.id}/${Date.now()}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const up = await sb.storage.from(bucket).upload(path, bytes, {
    contentType: file.type || "application/octet-stream",
    upsert: true,
  });
  if (up.error) return Response.json({ error: up.error.message }, { status: 500 });

  const url = sb.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  return Response.json({ url });
}

