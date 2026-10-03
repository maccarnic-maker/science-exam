export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth-edge";
import { generateId, generateToken } from "@/lib/utils";
import { getDB } from "@/lib/cloudflare";

export async function GET(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const exams = await db
      .prepare("SELECT e.*, COUNT(q.id) as question_count FROM exams e LEFT JOIN questions q ON q.exam_id = e.id GROUP BY e.id ORDER BY e.created_at DESC")
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
  const { title, description, subject, time_limit, classrooms } = body;

  if (!title || !classrooms?.length)
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  const examId = generateId();
  const token = generateToken();

  try {
    // Ensure teacher row exists to avoid Foreign Key constraint failure
    await db
      .prepare("INSERT INTO teachers (id, email, name) VALUES (?, ?, ?) ON CONFLICT(id) DO NOTHING")
      .bind(session.email, session.email, session.name || "ครูผู้สอน")
      .run();

    await db
      .prepare("INSERT INTO exams (id, teacher_id, title, description, subject, time_limit, token) VALUES (?,?,?,?,?,?,?)")
      .bind(examId, session.email, title, description ?? "", subject ?? "วิทยาศาสตร์", time_limit ?? 60, token)
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
  };

  if (typeof body.id !== "string" || !body.id.trim()) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates: string[] = [];
  const values: (string | number)[] = [];

  if (body.is_active !== undefined) {
    if (typeof body.is_active !== "boolean" && body.is_active !== 0 && body.is_active !== 1) {
      return NextResponse.json({ error: "รูปแบบสถานะการสอบไม่ถูกต้อง" }, { status: 400 });
    }
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
