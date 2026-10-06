
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const code = searchParams.get("code") || searchParams.get("token");
  const queryParam = id || code;
  if (!queryParam) return NextResponse.json({ error: "Missing id or code" }, { status: 400 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const exam = await db
      .prepare("SELECT id, title, description, subject, time_limit, token FROM exams WHERE (id = ? OR token = ?) AND is_active = 1")
      .bind(queryParam, queryParam)
      .first<{ id: string; title: string; description: string; subject: string; time_limit: number; token: string }>();

    if (!exam) return NextResponse.json({ error: "Exam not found or closed" }, { status: 404 });
    return NextResponse.json(exam);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
