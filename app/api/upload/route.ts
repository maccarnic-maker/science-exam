// app/api/upload/route.ts – อัปโหลดรูปภาพไปยัง Cloudflare R2
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 });

  const allowed = ["image/jpeg", "image/png", "image/gif", "image/webp"];
  if (!allowed.includes(file.type))
    return NextResponse.json({ error: "Invalid file type" }, { status: 400 });

  if (file.size > 5 * 1024 * 1024)
    return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });

  try {
    // ใช้ Cloudflare R2 binding (production) หรือ base64 data URL (dev)
    const env = (req as NextRequest & { env?: { R2?: unknown } }).env;
    const R2 = (env as { R2?: { put: (k: string, v: ArrayBuffer, opts: object) => Promise<void> } } | undefined)?.R2;

    const ext = file.name.split(".").pop() ?? "jpg";
    const key = `questions/${crypto.randomUUID()}.${ext}`;

    if (R2) {
      const buffer = await file.arrayBuffer();
      await R2.put(key, buffer, { httpMetadata: { contentType: file.type } });
      const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
      const publicUrl = `${origin}/api/files/${key}`;
      return NextResponse.json({ url: publicUrl, key });
    }

    // Dev fallback: base64 data URL
    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;
    return NextResponse.json({ url: dataUrl, key: "local" });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
