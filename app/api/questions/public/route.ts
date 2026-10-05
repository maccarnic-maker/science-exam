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
      .prepare("SELECT id, time_limit FROM exams WHERE id = ? AND is_active = 1")
      .bind(examId)
      .first<{ id: string; time_limit: number }>();

    if (!exam) return NextResponse.json({ error: "Exam not available or closed" }, { status: 404 });

    // 1. Check or Create session for student to track live behavior
    let sessionId: string | null = null;
    if (classroomId && studentName && studentNumber) {
      const existing = await db
        .prepare("SELECT id, status FROM exam_sessions WHERE exam_id = ? AND classroom_id = ? AND student_name = ? AND student_number = ? ORDER BY started_at DESC LIMIT 1")
        .bind(examId, classroomId, studentName.trim().replace(/\s+/g, ' '), studentNumber.trim())
        .first<{ id: string; status: string }>();

      if (existing) {
        sessionId = existing.id;
        // update last active
        await db.prepare("UPDATE exam_sessions SET last_active_at = unixepoch() WHERE id = ? AND status <> 'completed'").bind(sessionId).run();
      } else {
        sessionId = generateId();
        await db
          .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number, started_at, last_active_at, status, tab_switches) VALUES (?,?,?,?,?,unixepoch(),unixepoch(),'in_progress',0)")
          .bind(sessionId, examId, classroomId, studentName.trim().replace(/\s+/g, ' '), studentNumber.trim())
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

    // สุ่มลำดับข้อสอบ (Questions Shuffle) แต่เรียงเลขข้อ 1, 2, 3, 4, 5... ให้เป็นลำดับเสมอ
    const shuffledQuestions = shuffleArray(rawList).map((q, idx) => ({
      ...q,
      order_num: idx + 1,
    }));

    let saved = sessionId ? await db.prepare("SELECT question_order, draft_answers, progress_revision, started_at, status, score, total_points, tab_switches FROM exam_sessions WHERE id = ?").bind(sessionId).first<{ question_order: string | null; draft_answers: string; progress_revision: number; started_at: number; status: string; score: number | null; total_points: number | null; tab_switches: number }>() : null;
    if (sessionId && saved && !saved.question_order) {
      await db.prepare("UPDATE exam_sessions SET question_order = ? WHERE id = ? AND question_order IS NULL AND progress_revision = ?")
        .bind(JSON.stringify(shuffledQuestions), sessionId, saved.progress_revision).run();
      saved = await db.prepare("SELECT question_order, draft_answers, progress_revision, started_at, status, score, total_points, tab_switches FROM exam_sessions WHERE id = ?").bind(sessionId).first<typeof saved>();
    }
    const response = NextResponse.json({
      session_id: sessionId,
      questions: saved?.question_order ? JSON.parse(saved.question_order) : shuffledQuestions,
      answers: saved ? JSON.parse(saved.draft_answers) : {},
      revision: saved?.progress_revision ?? 0,
      tab_switches: saved?.tab_switches ?? 0,
      time_left: saved ? Math.max(0, saved.started_at + exam.time_limit * 60 - Math.floor(Date.now() / 1000)) : exam.time_limit * 60,
      status: saved?.status,
      score: saved?.score,
      total: saved?.total_points,
    }, { headers: { 'Cache-Control': 'no-store' } });
    if (sessionId) {
      const token = req.cookies.get(`exam_progress_${sessionId}`)?.value;
      const currentToken = await db.prepare('SELECT progress_token FROM exam_sessions WHERE id = ?').bind(sessionId).first<{ progress_token: string | null }>();
      const secret = token && token === currentToken?.progress_token ? token : crypto.randomUUID();
      await db.prepare('UPDATE exam_sessions SET progress_token = ? WHERE id = ?').bind(secret, sessionId).run();
      response.cookies.set(`exam_progress_${sessionId}`, secret, { httpOnly: true, secure: true, sameSite: 'strict', path: '/', maxAge: 86400 });
    }
    return response;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
