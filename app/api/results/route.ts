export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";
import { getTeacherSession } from "@/lib/auth-edge";
import { getDB } from "@/lib/cloudflare";

interface ResultAnswer {
  question_id: string;
  choice_id: string;
}

// POST /api/results – นักเรียนส่งคำตอบ
export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as {
    session_id?: string;
    exam_id?: string;
    classroom_id?: string;
    student_name?: string;
    student_number?: string;
    answers?: unknown;
  };
  const { session_id, exam_id, classroom_id, student_name, student_number, answers } = body;

  if (!exam_id || !classroom_id || !student_name || !student_number)
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  let actualSessionId = session_id;
  let sessionStartedAt = Math.floor(Date.now() / 1000);

  try {
    if (actualSessionId) {
      // ตรวจสอบว่า session ยังอยู่หรือไม่
      const existing = await db
        .prepare("SELECT id, exam_id, started_at, status FROM exam_sessions WHERE id = ?")
        .bind(actualSessionId)
        .first<{ id: string; exam_id: string; started_at: number; status: string }>();

      if (!existing) {
        return NextResponse.json({ error: "รอบสอบของคุณถูกยกเลิกแล้ว" }, { status: 403 });
      }
      if (existing.exam_id !== exam_id) {
        return NextResponse.json({ error: "ข้อมูลรอบสอบไม่ตรงกัน" }, { status: 403 });
      }
      if (existing.status === "completed") {
        return NextResponse.json({ error: "ข้อสอบชุดนี้ถูกส่งไปแล้ว" }, { status: 409 });
      }
      sessionStartedAt = existing.started_at;
    } else {
      actualSessionId = generateId();
    }

    const exam = await db
      .prepare("SELECT time_limit FROM exams WHERE id = ?")
      .bind(exam_id)
      .first<{ time_limit: number }>();
    if (!exam) return NextResponse.json({ error: "ไม่พบข้อสอบ" }, { status: 404 });

    const questionRows = await db
      .prepare("SELECT id, points FROM questions WHERE exam_id = ? ORDER BY order_num")
      .bind(exam_id)
      .all<{ id: string; points: number }>();
    const examQuestions = questionRows.results ?? [];
    const questionMap = new Map(examQuestions.map((question) => [question.id, question]));
    const submittedAnswers = Array.isArray(answers) ? answers : [];
    const normalizedAnswers: ResultAnswer[] = [];
    const seenQuestionIds = new Set<string>();

    for (const answer of submittedAnswers) {
      if (!answer || typeof answer !== "object") {
        return NextResponse.json({ error: "รูปแบบคำตอบไม่ถูกต้อง" }, { status: 400 });
      }
      const candidate = answer as Partial<ResultAnswer>;
      if (!candidate.question_id || !candidate.choice_id || typeof candidate.question_id !== "string" || typeof candidate.choice_id !== "string") {
        return NextResponse.json({ error: "ข้อมูลคำตอบไม่ครบ" }, { status: 400 });
      }
      if (!questionMap.has(candidate.question_id)) {
        return NextResponse.json({ error: "พบคำตอบของข้อสอบที่ไม่อยู่ในชุดนี้" }, { status: 400 });
      }
      if (seenQuestionIds.has(candidate.question_id)) {
        return NextResponse.json({ error: "พบคำตอบซ้ำในข้อสอบเดียวกัน" }, { status: 400 });
      }

      const choice = await db
        .prepare("SELECT question_id, is_correct FROM choices WHERE id = ?")
        .bind(candidate.choice_id)
        .first<{ question_id: string; is_correct: number }>();
      if (!choice || choice.question_id !== candidate.question_id) {
        return NextResponse.json({ error: "ตัวเลือกคำตอบไม่ตรงกับข้อสอบ" }, { status: 400 });
      }

      seenQuestionIds.add(candidate.question_id);
      normalizedAnswers.push({ question_id: candidate.question_id, choice_id: candidate.choice_id });
    }

    const missingQuestionIds = examQuestions
      .map((question) => question.id)
      .filter((questionId) => !seenQuestionIds.has(questionId));
    const now = Math.floor(Date.now() / 1000);
    const timeExpired = now >= sessionStartedAt + Math.max(0, exam.time_limit) * 60;
    if (missingQuestionIds.length > 0 && !timeExpired) {
      return NextResponse.json({
        error: `กรุณาตอบข้อสอบให้ครบทุกข้อก่อนส่ง (ยังเหลือ ${missingQuestionIds.length} ข้อ)`,
        missing_count: missingQuestionIds.length,
      }, { status: 400 });
    }

    if (!session_id) {
      await db
        .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number, started_at, last_active_at, status) VALUES (?,?,?,?,?, ?, ?, 'in_progress')")
        .bind(actualSessionId, exam_id, classroom_id, student_name.trim(), student_number.trim(), sessionStartedAt, sessionStartedAt)
        .run();
    }

    let score = 0;
    const total = examQuestions.reduce((sum, question) => sum + (question.points ?? 0), 0);

    // ล้างคำตอบเดิมหากมี
    await db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(actualSessionId).run();

    for (const ans of normalizedAnswers) {
      const correct = await db
        .prepare("SELECT is_correct FROM choices WHERE id = ? AND question_id = ?")
        .bind(ans.choice_id, ans.question_id)
        .first<{ is_correct: number }>();

      const isCorrect = correct?.is_correct === 1;
      const pts = questionMap.get(ans.question_id)?.points ?? 0;
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

// PUT /api/results?session_id=xxx&action=reshuffle – ครูสั่งสุ่มข้อสอบใหม่ให้นักเรียนทำใหม่
export async function PUT(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

  try {
    // 1. ลบคำตอบที่นักเรียนบันทึกไว้
    await db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(sessionId).run();

    // 2. ปรับสถานะเป็น reshuffle และรีเซ็ตเวลาและคะแนน
    await db
      .prepare(
        "UPDATE exam_sessions SET status = 'reshuffle', score = NULL, total_points = NULL, submitted_at = NULL, started_at = unixepoch(), last_active_at = unixepoch() WHERE id = ?"
      )
      .bind(sessionId)
      .run();

    return NextResponse.json({ success: true, message: "สั่งสุ่มข้อสอบใหม่ให้นักเรียนแล้ว" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
