
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const result = await db
      .prepare("SELECT * FROM classrooms WHERE exam_id = ? ORDER BY grade, name")
      .bind(examId)
      .all();

    return NextResponse.json(result.results ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
