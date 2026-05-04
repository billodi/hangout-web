export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { requireUser } from "@/lib/auth";
import { uploadImageToCloudinary } from "@/lib/cloudinary";

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
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    return Response.json({ error: "Unsupported file type. Use PNG, JPG, or WEBP." }, { status: 400 });
  }

  try {
    const url = await uploadImageToCloudinary({ userId: user.id, file, kind: "diary" });
    return Response.json({ url });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
