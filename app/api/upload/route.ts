
import { NextRequest, NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth-edge";
import { getR2 } from "@/lib/cloudflare";

export async function POST(req: NextRequest) {
  const session = await getTeacherSession(req);
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
    const R2 = getR2(req);

    const ext = file.name.split(".").pop() ?? "jpg";
    const key = `questions/${crypto.randomUUID()}.${ext}`;

    if (R2) {
      const buffer = await file.arrayBuffer();
      await R2.put(key, buffer, { httpMetadata: { contentType: file.type } });
      const origin = req.headers.get("origin") ?? process.env.NEXTAUTH_URL ?? "";
      const publicUrl = `${origin}/api/files/${key}`;
      return NextResponse.json({ url: publicUrl, key });
    }

    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    const dataUrl = `data:${file.type};base64,${base64}`;
    return NextResponse.json({ url: dataUrl, key: "local" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
