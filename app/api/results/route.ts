export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";
import { getTeacherSession } from "@/lib/auth-edge";
import { getDB } from "@/lib/cloudflare";

// POST /api/results – นักเรียนส่งคำตอบ
export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as any;
  const { session_id, exam_id, classroom_id, student_name, student_number, answers } = body;

  if (!exam_id || !classroom_id || !student_name || !student_number)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  let actualSessionId = session_id;

  try {
    if (actualSessionId) {
      // ตรวจสอบว่า session ยังอยู่หรือไม่
      const existing = await db
        .prepare("SELECT id FROM exam_sessions WHERE id = ?")
        .bind(actualSessionId)
        .first<{ id: string }>();

      if (!existing) {
        return NextResponse.json({ error: "รอบสอบของคุณถูกยกเลิกแล้ว" }, { status: 403 });
      }
    } else {
      actualSessionId = generateId();
      await db
        .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number, started_at, last_active_at, status) VALUES (?,?,?,?,?,unixepoch(),unixepoch(),'in_progress')")
        .bind(actualSessionId, exam_id, classroom_id, student_name.trim(), student_number.trim())
        .run();
    }

    let score = 0;
    let total = 0;

    // ล้างคำตอบเดิมหากมี
    await db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(actualSessionId).run();

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
        .bind(generateId(), actualSessionId, ans.question_id, ans.choice_id, isCorrect ? 1 : 0)
        .run();
    }

    await db
      .prepare("UPDATE exam_sessions SET submitted_at = unixepoch(), last_active_at = unixepoch(), status = 'completed', score = ?, total_points = ? WHERE id = ?")
      .bind(score, total, actualSessionId)
      .run();

    return NextResponse.json({ session_id: actualSessionId, score, total, percent: total > 0 ? Math.round((score / total) * 100) : 0 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// GET /api/results?exam_id=xxx – ครูดูผลสอบและพฤติกรรม Real-time
export async function GET(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  try {
    const results = await db
      .prepare(`
        SELECT es.*, c.name as classroom_name, c.grade
        FROM exam_sessions es
        JOIN classrooms c ON c.id = es.classroom_id
        WHERE es.exam_id = ?
        ORDER BY es.last_active_at DESC, es.started_at DESC
      `)
      .bind(examId)
      .all();

    return NextResponse.json(results.results ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// DELETE /api/results?session_id=xxx – ครูลบนักเรียน / ยกเลิกรอบสอบ
export async function DELETE(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  try {
    await db.prepare("DELETE FROM exam_sessions WHERE id = ?").bind(sessionId).run();
    return NextResponse.json({ success: true, message: "ลบนักเรียนออกจากรอบสอบแล้ว" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
