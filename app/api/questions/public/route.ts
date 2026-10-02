// app/api/questions/public/route.ts – Public API สำหรับนักเรียนดึงข้อสอบ (ไม่มีเฉลย)
import { NextRequest, NextResponse } from "next/server";

type DB = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      all: () => Promise<{ results?: unknown[] }>;
      first: <T>() => Promise<T | null>;
    };
  };
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const db = (req as NextRequest & { env?: { DB?: DB } }).env?.DB;
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  // ตรวจสอบว่าข้อสอบเปิดอยู่
  const exam = await db
    .prepare("SELECT id FROM exams WHERE id = ? AND is_active = 1")
    .bind(examId)
    .first<{ id: string }>();

  if (!exam) return NextResponse.json({ error: "Exam not available" }, { status: 404 });

  const questions = await db
    .prepare("SELECT id, question_text, question_image, question_type, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num")
    .bind(examId)
    .all<{ id: string; question_text: string; question_image: string | null; points: number; order_num: number }>();

  const result = await Promise.all(
    ((questions.results ?? []) as { id: string }[]).map(async (q) => {
      const choices = await db
        .prepare("SELECT id, choice_text, choice_image, order_num FROM choices WHERE question_id = ? ORDER BY order_num")
        .bind(q.id)
        .all<{ id: string; choice_text: string; choice_image: string | null; order_num: number }>();
      return { ...q, choices: choices.results ?? [] };
    })
  );

  return NextResponse.json(result);
}
