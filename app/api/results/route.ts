
import { NextRequest, NextResponse } from "next/server";
import { generateId } from "@/lib/utils";
import { getTeacherSession } from "@/lib/auth-edge";
import { D1PreparedStatement, getDB } from "@/lib/cloudflare";
import { cleanupInactiveSessions } from "@/lib/session-cleanup";

interface ResultAnswer {
  question_id: string;
  choice_id: string;
}

interface ValidatedAnswer extends ResultAnswer {
  isCorrect: number;
}

function normalizeStudentName(name: string): string {
  let s = name.trim().replace(/\s+/g, "");
  const prefixes = [
    "เด็กชาย", "เด็กหญิง", "ด.ช.", "ด.ญ.", "ดช.", "ดญ.",
    "ด.ช", "ด.ญ", "ดช", "ดญ", "นาย", "นางสาว", "น.ส.", "นส.", "น.ส", "นส"
  ];
  for (const p of prefixes) {
    if (s.startsWith(p)) {
      s = s.substring(p.length);
      break;
    }
  }
  return s;
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
    revision?: number;
  };
  const { session_id, exam_id, classroom_id, student_name, student_number, answers } = body;

  if (!exam_id || !classroom_id || !student_name || !student_number || !Number.isInteger(body.revision))
    return NextResponse.json({ error: "ข้อมูลไม่ครบ" }, { status: 400 });

  let actualSessionId = session_id;
  let sessionStartedAt = Math.floor(Date.now() / 1000);

  try {
    if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (!actualSessionId) return NextResponse.json({ error: 'กรุณาเริ่มรอบสอบก่อนส่งคำตอบ' }, { status: 400 });
    const permission = await db.prepare('SELECT progress_token, student_name, student_number FROM exam_sessions WHERE id = ?').bind(actualSessionId).first<{ progress_token: string | null; student_name: string; student_number: string }>();
    const cookieToken = req.cookies.get(`exam_progress_${actualSessionId}`)?.value;
    const cookieMatches = !!(permission?.progress_token && cookieToken === permission.progress_token);
    const credsMatch = !!(permission && normalizeStudentName(permission.student_name) === normalizeStudentName(student_name) && String(permission.student_number).trim() === String(student_number).trim());
    if (!cookieMatches && !credsMatch) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (actualSessionId) {
      // ตรวจสอบว่า session ยังอยู่หรือไม่
      const existing = await db
        .prepare("SELECT id, exam_id, started_at, last_active_at, status, score, total_points, progress_revision FROM exam_sessions WHERE id = ?")
        .bind(actualSessionId)
        .first<{ id: string; exam_id: string; started_at: number; last_active_at: number | null; status: string; score: number | null; total_points: number | null; progress_revision: number }>();

      if (!existing) {
        return NextResponse.json({ error: "รอบสอบของคุณถูกยกเลิกแล้ว" }, { status: 403 });
      }

      if (existing.status !== "completed") {
        const lastActive = existing.last_active_at ?? existing.started_at;
        const nowSec = Math.floor(Date.now() / 1000);
        if (nowSec - lastActive > 1800) {
          await db.batch([
            db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(actualSessionId),
            db.prepare("DELETE FROM exam_sessions WHERE id = ?").bind(actualSessionId),
          ]);
          return NextResponse.json({ error: "รอบสอบของคุณหมดอายุและถูกลบออกแล้ว เนื่องจากออกจากระบบเกิน 30 นาที" }, { status: 403 });
        }
      }
      if (existing.exam_id !== exam_id) {
        return NextResponse.json({ error: "ข้อมูลรอบสอบไม่ตรงกัน" }, { status: 403 });
      }
      if (existing.status === 'reshuffle' || (body.revision !== undefined && body.revision !== existing.progress_revision)) {
        return NextResponse.json({ error: 'ครูเริ่มรอบสอบใหม่แล้ว กรุณาโหลดข้อสอบใหม่' }, { status: 409 });
      }
      if (existing.status === "completed") {
        const total = existing.total_points ?? 0;
        const score = existing.score ?? 0;
        return NextResponse.json({
          session_id: actualSessionId,
          score,
          total,
          percent: total > 0 ? Math.round((score / total) * 100) : 0,
          already_submitted: true,
        });
      }
      if (existing.status === "submitting") {
        return NextResponse.json(
          {
            error: "ระบบกำลังบันทึกคำตอบของคุณ",
            code: "SUBMISSION_IN_PROGRESS",
            session_id: actualSessionId,
            retry_after_ms: 1000,
          },
          { status: 409, headers: { "Retry-After": "1" } }
        );
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

    const assigned = actualSessionId ? await db.prepare('SELECT question_order FROM exam_sessions WHERE id = ?').bind(actualSessionId).first<{ question_order: string | null }>() : null;
    if (!assigned?.question_order) return NextResponse.json({ error: 'กรุณาเริ่มรอบสอบก่อนส่งคำตอบ' }, { status: 400 });
    const examQuestions = JSON.parse(assigned.question_order) as { id: string; points: number; correct_choice_id?: string; choices: { id: string }[] }[];
    const questionMap = new Map(examQuestions.map((question) => [question.id, question]));
    const submittedAnswers = Array.isArray(answers) ? answers : [];
    const normalizedAnswers: ValidatedAnswer[] = [];
    const seenQuestionIds = new Set<string>();
    const choiceRows = await db.prepare("SELECT id, question_id, is_correct FROM choices WHERE question_id IN (SELECT value FROM json_each(?))").bind(JSON.stringify(examQuestions.map(q => q.id))).all<{ id: string; question_id: string; is_correct: number }>();
    const choiceMap = new Map((choiceRows.results ?? []).map(choice => [choice.id, choice]));

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
      if (!questionMap.get(candidate.question_id)?.choices.some(c => c.id === candidate.choice_id)) return NextResponse.json({ error: 'ตัวเลือกไม่อยู่ในชุดที่ได้รับ' }, { status: 400 });
      if (seenQuestionIds.has(candidate.question_id)) {
        return NextResponse.json({ error: "พบคำตอบซ้ำในข้อสอบเดียวกัน" }, { status: 400 });
      }

      const choice = choiceMap.get(candidate.choice_id);
      if (!choice || choice.question_id !== candidate.question_id) {
        return NextResponse.json({ error: "ตัวเลือกคำตอบไม่ตรงกับข้อสอบ" }, { status: 400 });
      }

      seenQuestionIds.add(candidate.question_id);
      normalizedAnswers.push({
        question_id: candidate.question_id,
        choice_id: candidate.choice_id,
        isCorrect: questionMap.get(candidate.question_id)?.correct_choice_id ? (candidate.choice_id === questionMap.get(candidate.question_id)?.correct_choice_id ? 1 : 0) : (choice.is_correct === 1 ? 1 : 0),
      });
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

    const total = examQuestions.reduce((sum, question) => sum + (question.points ?? 0), 0);
    const score = normalizedAnswers.reduce((sum, answer) => {
      const points = questionMap.get(answer.question_id)?.points ?? 0;
      return sum + (answer.isCorrect === 1 ? points : 0);
    }, 0);
    const sessionId = actualSessionId;
    if (!sessionId) return NextResponse.json({ error: "ไม่พบรอบสอบ" }, { status: 400 });

    // Claim the session and write all answer rows in one D1 transaction.
    // Only the request that changes in_progress -> submitting may continue;
    // concurrent requests become harmless retries instead of overwrites.
    const statements: D1PreparedStatement[] = [];
    if (!session_id) {
      statements.push(
        db
          .prepare("INSERT INTO exam_sessions (id, exam_id, classroom_id, student_name, student_number, started_at, last_active_at, status) VALUES (?,?,?,?,?, ?, ?, 'in_progress')")
          .bind(sessionId, exam_id, classroom_id, student_name.trim(), student_number.trim(), sessionStartedAt, sessionStartedAt)
      );
    }

    statements.push(
      db
        .prepare("UPDATE exam_sessions SET status = 'submitting', last_active_at = unixepoch() WHERE id = ? AND status = 'in_progress' AND progress_revision = ? AND question_order = ?")
        .bind(sessionId, body.revision, assigned.question_order),
      db
        .prepare("DELETE FROM student_answers WHERE session_id = ? AND EXISTS (SELECT 1 FROM exam_sessions WHERE id = ? AND status = 'submitting')")
        .bind(sessionId, sessionId)
    );

    for (const answer of normalizedAnswers) {
      statements.push(
        db
          .prepare("INSERT INTO student_answers (id, session_id, question_id, choice_id, is_correct) SELECT ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM exam_sessions WHERE id = ? AND status = 'submitting')")
          .bind(generateId(), sessionId, answer.question_id, answer.choice_id, answer.isCorrect, sessionId)
      );
    }

    statements.push(
      db
        .prepare("UPDATE exam_sessions SET submitted_at = unixepoch(), last_active_at = unixepoch(), status = 'completed', score = ?, total_points = ? WHERE id = ? AND status = 'submitting'")
        .bind(score, total, sessionId)
    );

    await db.batch(statements);

    // Return the committed result for both the winning request and any
    // concurrent retry that arrived during the transaction.
    const committed = await db
      .prepare("SELECT status, score, total_points FROM exam_sessions WHERE id = ?")
      .bind(sessionId)
      .first<{ status: string; score: number | null; total_points: number | null }>();
    if (!committed) {
      return NextResponse.json({ error: "รอบสอบของคุณถูกยกเลิกแล้ว" }, { status: 403 });
    }
    if (committed.status === "completed") {
      const committedTotal = committed.total_points ?? 0;
      const committedScore = committed.score ?? 0;
      return NextResponse.json({
        session_id: sessionId,
        score: committedScore,
        total: committedTotal,
        percent: committedTotal > 0 ? Math.round((committedScore / committedTotal) * 100) : 0,
      });
    }

    if (committed.status !== 'submitting') return NextResponse.json({ error: 'ชุดสอบเปลี่ยนแล้ว กรุณาโหลดข้อสอบใหม่' }, { status: 409 });
    return NextResponse.json(
      {
        error: "ระบบกำลังบันทึกคำตอบของคุณ",
        code: "SUBMISSION_IN_PROGRESS",
        session_id: sessionId,
        retry_after_ms: 1000,
      },
      { status: 409, headers: { "Retry-After": "1" } }
    );
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
    await cleanupInactiveSessions(db, examId);

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
    // 2. ปรับสถานะเป็น reshuffle และรีเซ็ตเวลาและคะแนน
    await db.batch([
      db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(sessionId),
      db.prepare("UPDATE exam_sessions SET status = 'reshuffle', score = NULL, total_points = NULL, submitted_at = NULL, started_at = unixepoch(), last_active_at = unixepoch(), tab_switches = 0, question_order = NULL, draft_answers = '{}', progress_revision = progress_revision + 1 WHERE id = ?").bind(sessionId),
    ]);

    return NextResponse.json({ success: true, message: "สั่งสุ่มข้อสอบใหม่ให้นักเรียนแล้ว" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
