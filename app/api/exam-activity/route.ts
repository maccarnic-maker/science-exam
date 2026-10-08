
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/lib/cloudflare";

// POST /api/exam-activity – นักเรียนส่งเหตุการณ์ เช่น สลับหน้าจอ (Tab switch / Blur)
export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  try {
    const body = (await req.json()) as { session_id?: string; event_type?: string };
    const { session_id, event_type } = body;

    if (!session_id) return NextResponse.json({ error: "Missing session_id" }, { status: 400 });

    // Read status before recording anything. Completed sessions must be
    // immutable: delayed blur/heartbeat requests must not add activity.
    const current = await db
      .prepare("SELECT id, status, last_active_at, started_at FROM exam_sessions WHERE id = ?")
      .bind(session_id)
      .first<{ id: string; status: string; last_active_at: number | null; started_at: number }>();

    if (!current) {
      return NextResponse.json({ kicked: true, message: "คุณถูกครูผู้คุมสอบนำออกจากห้องสอบ หรือรอบสอบหมดอายุแล้ว" }, { status: 403 });
    }

    if (current.status === "completed") {
      return NextResponse.json({ success: true, status: "completed", recording: false });
    }

    // หากไม่กลับเข้าทำข้อสอบเกิน 30 นาที (1,800 วินาที) ให้ลบชื่อและรอบสอบออกทันที
    const lastActive = current.last_active_at ?? current.started_at;
    const nowSec = Math.floor(Date.now() / 1000);
    if (nowSec - lastActive > 1800) {
      await db.batch([
        db.prepare("DELETE FROM student_answers WHERE session_id = ?").bind(session_id),
        db.prepare("DELETE FROM exam_sessions WHERE id = ?").bind(session_id),
      ]);
      return NextResponse.json({
        kicked: true,
        message: "รอบสอบของคุณถูกยกเลิกและลบออกจากระบบ เนื่องจากออกจากระบบเกิน 30 นาที",
      }, { status: 403 });
    }

    if (current.status === "reshuffle") {
      // ครูสั่งสุ่มข้อสอบใหม่ -> เปลี่ยนสถานะกลับเป็น in_progress แล้วแจ้ง client
      await db
        .prepare("UPDATE exam_sessions SET status = 'in_progress', last_active_at = unixepoch() WHERE id = ?")
        .bind(session_id)
        .run();

      return NextResponse.json({ reshuffle: true, status: "in_progress" });
    }

    if (event_type === "tab_switch") {
      // The status condition closes the race where submission completes after
      // the initial read but before this update.
      await db
        .prepare("UPDATE exam_sessions SET tab_switches = tab_switches + 1, last_active_at = unixepoch() WHERE id = ? AND status = 'in_progress'")
        .bind(session_id)
        .run();
    } else if (event_type === "heartbeat") {
      await db
        .prepare("UPDATE exam_sessions SET last_active_at = unixepoch() WHERE id = ? AND status = 'in_progress'")
        .bind(session_id)
        .run();
    } else {
      return NextResponse.json({ error: "Invalid event_type" }, { status: 400 });
    }

    const latest = await db
      .prepare("SELECT status FROM exam_sessions WHERE id = ?")
      .bind(session_id)
      .first<{ status: string }>();

    return NextResponse.json({ success: true, status: latest?.status ?? current.status, recording: latest?.status !== "completed" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
