export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";
import { getTeacherSession } from "@/lib/auth-edge";

type DB = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => {
      all: () => Promise<{ results?: unknown[] }>;
      first: <T>() => Promise<T | null>;
      run: () => Promise<unknown>;
    };
  };
};

function getDB(req: NextRequest): DB | undefined {
  return (req as NextRequest & { env?: { DB?: DB } }).env?.DB;
}

// POST /api/results – นักเรียนส่งคำตอบ
export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = await req.json();
  const { exam_id, classroom_id, student_name, student_number, answers } = body;

  if (!exam_id || !classroom_id || !student_name || !student_number)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  const sessionId = generateId();

  await db
    .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number) VALUES (?,?,?,?,?)")
    .bind(sessionId, exam_id, classroom_id, student_name.trim(), student_number.trim())
    .run();

  let score = 0;
  let total = 0;

  for (const ans of (answers ?? []) as { question_id: string; choice_id: string }[]) {
    const correct = await db
      .prepare("SELECT is_correct, (SELECT points FROM questions WHERE id = ?) as pts FROM choices WHERE id = ?")
      .bind(ans.question_id, ans.choice_id)
      .first<{ is_correct: number; pts: number }>();

    const isCorrect = correct?.is_correct === 1;
    const pts = correct?.pts ?? 1;
    total += pts;
    if (isCorrect) score += pts;

    await db
      .prepare("INSERT INTO student_answers (id, session_id, question_id, choice_id, is_correct) VALUES (?,?,?,?,?)")
      .bind(generateId(), sessionId, ans.question_id, ans.choice_id, isCorrect ? 1 : 0)
      .run();
  }

  await db
    .prepare("UPDATE exam_sessions SET submitted_at = unixepoch(), score = ?, total_points = ? WHERE id = ?")
    .bind(score, total, sessionId)
    .run();

  return NextResponse.json({ session_id: sessionId, score, total, percent: total > 0 ? Math.round((score / total) * 100) : 0 });
}

// GET /api/results?exam_id=xxx – ครูดูผลสอบ
export async function GET(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const results = await db
    .prepare(`
      SELECT es.*, c.name as classroom_name, c.grade
      FROM exam_sessions es
      JOIN classrooms c ON c.id = es.classroom_id
      WHERE es.exam_id = ?
      ORDER BY es.submitted_at DESC
    `)
    .bind(examId)
    .all();

  return NextResponse.json(results.results ?? []);
}
