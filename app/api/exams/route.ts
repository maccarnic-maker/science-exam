// app/api/exams/route.ts – CRUD สำหรับชุดข้อสอบ
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateId, generateToken } from "@/lib/utils";

function getDB(req: NextRequest) {
  return (req as NextRequest & { env?: { DB?: unknown } }).env?.DB as
    | { prepare: (q: string) => { bind: (...v: unknown[]) => { all: () => Promise<{ results?: unknown[] }>; first: () => Promise<unknown>; run: () => Promise<unknown> } } }
    | undefined;
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const exams = await db
    .prepare("SELECT e.*, COUNT(q.id) as question_count FROM exams e LEFT JOIN questions q ON q.exam_id = e.id GROUP BY e.id ORDER BY e.created_at DESC")
    .bind()
    .all();

  return NextResponse.json(exams.results ?? []);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = await req.json();
  const { title, description, subject, time_limit, classrooms } = body;

  if (!title || !classrooms?.length)
    return NextResponse.json({ error: "กรุณากรอกข้อมูลให้ครบ" }, { status: 400 });

  const examId = generateId();
  const token = generateToken();

  await db
    .prepare("INSERT INTO exams (id, teacher_id, title, description, subject, time_limit, token) VALUES (?,?,?,?,?,?,?)")
    .bind(examId, session.user?.email ?? "unknown", title, description ?? "", subject ?? "วิทยาศาสตร์", time_limit ?? 60, token)
    .run();

  for (const cls of classrooms) {
    await db
      .prepare("INSERT INTO classrooms (id, exam_id, name, grade) VALUES (?,?,?,?)")
      .bind(generateId(), examId, cls.name, cls.grade)
      .run();
  }

  return NextResponse.json({ id: examId, token }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = await req.json();
  const { id, is_active } = body;

  await db
    .prepare("UPDATE exams SET is_active = ? WHERE id = ?")
    .bind(is_active ? 1 : 0, id)
    .run();

  return NextResponse.json({ success: true });
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  await db.prepare("DELETE FROM exams WHERE id = ?").bind(id).run();
  return NextResponse.json({ success: true });
}
