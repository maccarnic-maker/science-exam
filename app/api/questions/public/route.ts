export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";
import { generateId } from "@/lib/utils";

// Fisher-Yates shuffle helper
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  const classroomId = searchParams.get("classroom_id");
  const studentName = searchParams.get("student_name");
  const studentNumber = searchParams.get("student_number");

  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const exam = await db
      .prepare("SELECT id FROM exams WHERE id = ? AND is_active = 1")
      .bind(examId)
      .first<{ id: string }>();

    if (!exam) return NextResponse.json({ error: "Exam not available or closed" }, { status: 404 });

    // 1. Check or Create session for student to track live behavior
    let sessionId: string | null = null;
    if (classroomId && studentName && studentNumber) {
      const existing = await db
        .prepare("SELECT id, status FROM exam_sessions WHERE exam_id = ? AND student_name = ? AND student_number = ? ORDER BY started_at DESC LIMIT 1")
        .bind(examId, studentName.trim(), studentNumber.trim())
        .first<{ id: string; status: string }>();

      if (existing) {
        sessionId = existing.id;
        // update last active
        await db.prepare("UPDATE exam_sessions SET last_active_at = unixepoch() WHERE id = ?").bind(sessionId).run();
      } else {
        sessionId = generateId();
        await db
          .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number, started_at, last_active_at, status, tab_switches) VALUES (?,?,?,?,?,unixepoch(),unixepoch(),'in_progress',0)")
          .bind(sessionId, examId, classroomId, studentName.trim(), studentNumber.trim())
          .run();
      }
    }

    // 2. Fetch questions
    const questions = await db
      .prepare("SELECT id, question_text, question_image, question_type, points, order_num FROM questions WHERE exam_id = ? ORDER BY order_num")
      .bind(examId)
      .all();

    const rawList = await Promise.all(
      ((questions.results ?? []) as { id: string; question_text: string; question_image: string | null; question_type: string; points: number; order_num: number }[]).map(async (q) => {
        const choices = await db
          .prepare("SELECT id, choice_text, choice_image, order_num FROM choices WHERE question_id = ? ORDER BY order_num")
          .bind(q.id)
          .all();
        // สุ่มตัวเลือก (Choices Shuffle) สำหรับแต่ละข้อ
        const shuffledChoices = shuffleArray(choices.results ?? []);
        return { ...q, choices: shuffledChoices };
      })
    );

    // สุ่มลำดับข้อสอบ (Questions Shuffle)
    const shuffledQuestions = shuffleArray(rawList);

    return NextResponse.json({
      session_id: sessionId,
      questions: shuffledQuestions,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
