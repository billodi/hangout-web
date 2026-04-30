export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const key = process.env.VAPID_PUBLIC_KEY ?? "";
  return Response.json({ publicKey: key });
}

