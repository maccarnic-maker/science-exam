export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getTeacherSession } from "@/lib/auth-edge";
import { generateId } from "@/lib/utils";
import { getDB } from "@/lib/cloudflare";

export async function GET(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  try {
    const questions = await db
      .prepare("SELECT * FROM questions WHERE exam_id = (SELECT COALESCE(bank_exam_id,id) FROM exams WHERE id = ?) ORDER BY order_num,id")
      .bind(examId)
      .all();

    const result = await Promise.all(
      ((questions.results ?? []) as { id: string }[]).map(async (q) => {
        const choices = await db
          .prepare("SELECT * FROM choices WHERE question_id = ? ORDER BY order_num")
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

export async function POST(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as any;
  const { exam_id, question_text, question_image, question_type, points, order_num, choices } = body;

  const qId = generateId();

  try {
    const linked = await db.prepare('SELECT bank_exam_id FROM exams WHERE id = ?').bind(exam_id).first<{ bank_exam_id: string | null }>();
    if (linked?.bank_exam_id) return NextResponse.json({ error: 'กรุณาเพิ่มข้อสอบที่คลังต้นทาง' }, { status: 409 });
    await db
      .prepare("INSERT INTO questions (id, exam_id, order_num, question_text, question_image, question_type, points) VALUES (?,?,?,?,?,?,?)")
      .bind(qId, exam_id, order_num ?? 1, question_text, question_image ?? null, question_type ?? "multiple_choice", points ?? 1)
      .run();

    if (choices?.length) {
      for (const c of choices as { text: string; image?: string; is_correct: boolean; order_num: number }[]) {
        await db
          .prepare("INSERT INTO choices (id, question_id, order_num, choice_text, choice_image, is_correct) VALUES (?,?,?,?,?,?)")
          .bind(generateId(), qId, c.order_num, c.text, c.image ?? null, c.is_correct ? 1 : 0)
          .run();
      }
    }

    return NextResponse.json({ id: qId }, { status: 201 });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getTeacherSession(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const body = (await req.json()) as any;
  const { id, question_text, question_image, points, choices } = body;

  try {
    const used = await db.prepare("SELECT id FROM exam_sessions s WHERE EXISTS (SELECT 1 FROM json_each(s.question_order) q WHERE json_extract(q.value,'$.id') = ?) LIMIT 1").bind(id).first();
    if (used) return NextResponse.json({ error: 'ข้อนี้ถูกใช้ในรอบสอบแล้ว กรุณาเพิ่มข้อใหม่แทนเพื่อรักษาชุดสอบเดิม' }, { status: 409 });
    await db
      .prepare("UPDATE questions SET question_text = ?, question_image = ?, points = ? WHERE id = ?")
      .bind(question_text, question_image ?? null, points ?? 1, id)
      .run();

    await db.prepare("DELETE FROM choices WHERE question_id = ?").bind(id).run();

    for (const c of (choices ?? []) as { text: string; image?: string; is_correct: boolean; order_num: number }[]) {
      await db
        .prepare("INSERT INTO choices (id, question_id, order_num, choice_text, choice_image, is_correct) VALUES (?,?,?,?,?,?)")
        .bind(generateId(), id, c.order_num, c.text, c.image ?? null, c.is_correct ? 1 : 0)
        .run();
    }

    return NextResponse.json({ success: true });
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
    const used = await db.prepare("SELECT id FROM exam_sessions s WHERE EXISTS (SELECT 1 FROM json_each(s.question_order) q WHERE json_extract(q.value,'$.id') = ?) LIMIT 1").bind(id).first();
    if (used) return NextResponse.json({ error: 'ไม่สามารถลบข้อที่มีนักเรียนได้รับแล้ว' }, { status: 409 });
    await db.prepare("DELETE FROM questions WHERE id = ?").bind(id).run();
    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
