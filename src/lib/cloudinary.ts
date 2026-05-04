import { createHash, randomUUID } from "node:crypto";

type UploadKind = "avatars" | "diary";

type CloudinaryConfig = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
};

function parseCloudinaryUrl(urlRaw: string): CloudinaryConfig | null {
  try {
    const u = new URL(urlRaw);
    if (u.protocol !== "cloudinary:") return null;
    const apiKey = decodeURIComponent(u.username);
    const apiSecret = decodeURIComponent(u.password);
    const cloudName = u.hostname;
    if (!apiKey || !apiSecret || !cloudName) return null;
    return { cloudName, apiKey, apiSecret };
  } catch {
    return null;
  }
}

function getCloudinaryConfig(): CloudinaryConfig {
  const fromUrl = process.env.CLOUDINARY_URL ? parseCloudinaryUrl(process.env.CLOUDINARY_URL) : null;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME ?? fromUrl?.cloudName ?? "";
  const apiKey = process.env.CLOUDINARY_API_KEY ?? fromUrl?.apiKey ?? "";
  const apiSecret = process.env.CLOUDINARY_API_SECRET ?? fromUrl?.apiSecret ?? "";

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary not configured");
  }
  return { cloudName, apiKey, apiSecret };
}

function safeExt(fileName: string, mimeType: string): string {
  const lower = fileName.toLowerCase();
  if (mimeType === "image/png" || lower.endsWith(".png")) return "png";
  if (mimeType === "image/jpeg" || lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "jpg";
  if (mimeType === "image/webp" || lower.endsWith(".webp")) return "webp";
  return "bin";
}

export async function uploadImageToCloudinary(params: {
  userId: string;
  file: File;
  kind: UploadKind;
}): Promise<string> {
  const cfg = getCloudinaryConfig();
  const ext = safeExt(params.file.name, params.file.type);
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = `billixa/${params.kind}/${params.userId}`;
  const publicId = `${Date.now()}-${randomUUID()}.${ext}`;
  const toSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${cfg.apiSecret}`;
  const signature = createHash("sha1").update(toSign).digest("hex");

  const fd = new FormData();
  fd.append("file", params.file);
  fd.append("api_key", cfg.apiKey);
  fd.append("timestamp", String(timestamp));
  fd.append("folder", folder);
  fd.append("public_id", publicId);
  fd.append("signature", signature);

  const endpoint = `https://api.cloudinary.com/v1_1/${cfg.cloudName}/image/upload`;
  const res = await fetch(endpoint, { method: "POST", body: fd });
  const data = (await res.json().catch(() => null)) as { secure_url?: string; error?: { message?: string } } | null;
  if (!res.ok || !data?.secure_url) {
    throw new Error(data?.error?.message || "Cloudinary upload failed");
  }
  return data.secure_url;
}

