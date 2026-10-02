export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getR2 } from "@/lib/cloudflare";

export async function GET(
  req: NextRequest,
  { params }: { params: { key: string[] } }
) {
  const key = params.key.join("/");
  const R2 = getR2(req);

  if (!R2) {
    return new NextResponse("Storage not available", { status: 503 });
  }

  try {
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
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return new NextResponse(message, { status: 500 });
  }
}
