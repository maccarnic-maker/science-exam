import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

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

export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const body = (await req.json()) as {
      exam_id?: string;
      classroom_id?: string;
      student_number?: string;
      student_name?: string;
    };

    const { exam_id, classroom_id, student_number, student_name } = body;
    if (!exam_id || !classroom_id || !student_number?.trim() || !student_name?.trim()) {
      return NextResponse.json({ error: "ข้อมูลไม่ครบถ้วน" }, { status: 400 });
    }

    const cleanNumber = student_number.trim();
    const cleanName = student_name.trim().replace(/\s+/g, " ");
    const numInt = parseInt(cleanNumber, 10);

    let existing = null;
    if (!isNaN(numInt) && numInt > 0) {
      existing = await db
        .prepare(
          "SELECT id, status, student_name, student_number, score, total_points FROM exam_sessions WHERE exam_id = ? AND classroom_id = ? AND (student_number = ? OR CAST(student_number AS INTEGER) = ?) ORDER BY started_at DESC LIMIT 1"
        )
        .bind(exam_id, classroom_id, cleanNumber, numInt)
        .first<{ id: string; status: string; student_name: string; student_number: string; score: number | null; total_points: number | null }>();
    } else {
      existing = await db
        .prepare(
          "SELECT id, status, student_name, student_number, score, total_points FROM exam_sessions WHERE exam_id = ? AND classroom_id = ? AND student_number = ? ORDER BY started_at DESC LIMIT 1"
        )
        .bind(exam_id, classroom_id, cleanNumber)
        .first<{ id: string; status: string; student_name: string; student_number: string; score: number | null; total_points: number | null }>();
    }

    if (existing) {
      const normInput = normalizeStudentName(cleanName);
      const normExisting = normalizeStudentName(existing.student_name);

      if (normInput !== normExisting) {
        return NextResponse.json({
          ok: false,
          conflict: true,
          existing_name: existing.student_name,
          message: `เลขที่ ${cleanNumber} มีผู้เข้าสอบแล้ว (${existing.student_name}) หากไม่ใช่คุณ กรุณาตรวจสอบเลขที่ให้ถูกต้อง`,
        });
      }

      // ชื่อตรงกัน (เป็นนักเรียนคนเดิมที่หลุดแล้วกลับเข้ามาใหม่)
      if (existing.status === "completed") {
        return NextResponse.json({
          ok: false,
          completed: true,
          score: existing.score,
          total: existing.total_points,
          message: `คุณได้ส่งข้อสอบชุดนี้เรียบร้อยแล้ว ได้คะแนน ${existing.score ?? 0}/${existing.total_points ?? 0} คะแนน`,
        });
      }

      return NextResponse.json({
        ok: true,
        resuming: true,
        message: "ยินดีต้อนรับกลับเข้าสู่การสอบ ข้อมูลคำตอบเดิมจะถูกโหลดให้อัตโนมัติ",
      });
    }

    return NextResponse.json({
      ok: true,
      resuming: false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
