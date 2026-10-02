export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const exam = await db
      .prepare("SELECT id FROM exams WHERE id = ? AND is_active = 1")
      .bind(examId)
      .first<{ id: string }>();

    if (!exam) return NextResponse.json({ error: "Exam not available" }, { status: 404 });

    const questions = await db
      .prepare("SELECT id, question_text, question_image, question_type, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num")
      .bind(examId)
      .all();

    const result = await Promise.all(
      ((questions.results ?? []) as { id: string }[]).map(async (q) => {
        const choices = await db
          .prepare("SELECT id, choice_text, choice_image, order_num FROM choices WHERE question_id = ? ORDER BY order_num")
          .bind(q.id)
          .all();
        return { ...q, choices: choices.results ?? [] };
      })
    );

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
