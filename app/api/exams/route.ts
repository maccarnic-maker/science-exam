
import { NextRequest, NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth-edge";
import { generateId, generateToken } from "@/lib/utils";
import { getDB } from "@/lib/cloudflare";
import { cleanupInactiveSessions } from "@/lib/session-cleanup";

export async function GET(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    await cleanupInactiveSessions(db);

    const exams = await db
      .prepare(`
        SELECT e.*, 
          (SELECT MAX(COALESCE(s.last_active_at, s.submitted_at, s.started_at)) FROM exam_sessions s WHERE s.exam_id = e.id) AS last_student_activity_at,
          (SELECT MAX(s.started_at) FROM exam_sessions s WHERE s.exam_id = e.id) AS last_student_started_at,
          (SELECT COUNT(DISTINCT s.id) FROM exam_sessions s WHERE s.exam_id = e.id) AS student_count,
          COALESCE(e.draw_count, COUNT(DISTINCT q.id)) as question_count, 
          COUNT(DISTINCT q.id) as pool_count, 
          GROUP_CONCAT(DISTINCT cls.grade) AS grades 
        FROM exams e 
        LEFT JOIN questions q ON q.exam_id = COALESCE(e.bank_exam_id,e.id) 
        LEFT JOIN classrooms cls ON cls.exam_id = e.id 
        GROUP BY e.id 
        ORDER BY last_student_activity_at DESC, e.created_at DESC
      `)
      .bind()
      .all();

    return NextResponse.json(exams.results ?? []);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as any;
  const { title, description, subject, time_limit, classrooms, bank_exam_id, draw_count } = body;

  if (!title || !classrooms?.length)
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  const examId = generateId();
  const token = generateToken();

  try {
    const minutes = Number(time_limit ?? 60);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 300) return NextResponse.json({ error: 'เวลาสอบต้องเป็น 1–300 นาที' }, { status: 400 });
    let count: number | null = null;
    if (bank_exam_id) {
      const bank = await db.prepare('SELECT subject FROM exams WHERE id = ? AND bank_exam_id IS NULL').bind(bank_exam_id).first<{ subject: string }>();
      const grades = await db.prepare('SELECT DISTINCT grade FROM classrooms WHERE exam_id = ?').bind(bank_exam_id).all<{ grade: string }>();
      const size = await db.prepare('SELECT COUNT(*) AS count FROM questions WHERE exam_id = ?').bind(bank_exam_id).first<{ count: number }>();
      count = Number(draw_count ?? 30);
      if (!bank || bank.subject !== subject || classrooms.some((c: { grade: string }) => !grades.results?.some(g => g.grade === c.grade)) || !Number.isInteger(count) || count < 1 || count > (size?.count ?? 0)) return NextResponse.json({ error: 'คลัง วิชา ชั้น หรือจำนวนข้อไม่ตรงกัน' }, { status: 400 });
    }
    // Ensure teacher row exists to avoid Foreign Key constraint failure
    await db
      .prepare("INSERT INTO teachers (id, email, name) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(session.email, session.email, session.name || "ครูผู้สอน")
      .run();

    await db
      .prepare("INSERT INTO exams (id, teacher_id, title, description, subject, time_limit, token, bank_exam_id, draw_count) VALUES (?,?,?,?,?,?,?,?,?)")
      .bind(examId, session.email, title, description ?? "", subject ?? "วิทยาศาสตร์", minutes, token, bank_exam_id || null, count)
      .run();

    for (const cls of classrooms) {
      await db
        .prepare("INSERT INTO classrooms (id, exam_id, name, grade) VALUES (?,?,?,?)")
        .bind(generateId(), examId, cls.name, cls.grade)
        .run();
    }

    return NextResponse.json({ id: examId, token }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as {
    id?: unknown;
    is_active?: unknown;
    time_limit?: unknown;
    draw_count?: unknown;
  };

  if (typeof body.id !== "string" || !body.id.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.draw_count !== undefined) {
    const count = Number(body.draw_count);
    const pool = await db.prepare('SELECT COUNT(*) AS count FROM questions WHERE exam_id = (SELECT COALESCE(bank_exam_id,id) FROM exams WHERE id = ?)').bind(body.id.trim()).first<{ count: number }>();
    if (!Number.isInteger(count) || count < 1 || count > (pool?.count ?? 0)) return NextResponse.json({ error: 'จำนวนข้อที่ใช้สอบต้องอยู่ระหว่าง 1 ถึงจำนวนข้อในคลัง' }, { status: 400 });
    updates.push('draw_count = ?'); values.push(count);
  }

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean" && body.is_active !== 0 && body.is_active !== 1) {
      return NextResponse.json({ error: "รูปแบบสถานะการสอบไม่ถูกต้อง" }, { status: 400 });
    }
    if (body.is_active) updates.push("last_opened_at = CASE WHEN is_active = 0 THEN unixepoch() ELSE last_opened_at END");
    updates.push("is_active = ?");
    values.push(body.is_active ? 1 : 0);
  }

  if (body.time_limit !== undefined) {
    const timeLimit = Number(body.time_limit);
    if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300) {
      return NextResponse.json({ error: "เวลาสอบต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 300 นาที" }, { status: 400 });
    }
    updates.push("time_limit = ?");
    values.push(timeLimit);
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "ไม่มีข้อมูลสำหรับแก้ไข" }, { status: 400 });
  }

  try {
    await db
      .prepare(`UPDATE exams SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...values, body.id.trim())
      .run();

    return NextResponse.json({ success: true, updated: updates });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  try {
    await db.prepare("DELETE FROM exams WHERE id = ?").bind(id).run();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
