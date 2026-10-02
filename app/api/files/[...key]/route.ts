// app/api/files/[...key]/route.ts – Proxy ไฟล์จาก R2 ออกมาสู่ browser
import { NextRequest, NextResponse } from "next/server";

type R2Bucket = {
  get(key: string): Promise<{
    body: ReadableStream;
    httpMetadata?: { contentType?: string };
  } | null>;
};

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const key = params.key.join("/");
  const R2 = (req as NextRequest & { env?: { R2?: R2Bucket } }).env?.R2;

  if (!R2) {
    return new NextResponse("Storage not available", { status: 503 });
  }

  const object = await R2.get(key);
  if (!object) {
    return new NextResponse("Not found", { status: 404 });
  }

  const contentType = object.httpMetadata?.contentType ?? "image/jpeg";

  return new NextResponse(object.body, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
