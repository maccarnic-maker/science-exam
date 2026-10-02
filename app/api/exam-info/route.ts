// app/api/exam-info/route.ts – Public API สำหรับนักเรียนดึงข้อมูลข้อสอบ
import { NextRequest, NextResponse } from "next/server";

type DB = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => { first: <T>() => Promise<T | null> };
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const db = (req as NextRequest & { env?: { DB?: DB } }).env?.DB;
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const exam = await db
    .prepare("SELECT id, title, description, subject, time_limit FROM exams WHERE id = ? AND is_active = 1")
    .bind(id)
    .first<{ id: string; title: string; description: string; subject: string; time_limit: number }>();

  if (!exam) return NextResponse.json({ error: "Exam not found or closed" }, { status: 404 });
  return NextResponse.json(exam);
}
