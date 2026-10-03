export const runtime = 'edge';

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

    if (event_type === "tab_switch") {
      await db
        .prepare("UPDATE exam_sessions SET tab_switches = tab_switches + 1, last_active_at = unixepoch() WHERE id = ?")
        .bind(session_id)
        .run();
    } else if (event_type === "heartbeat") {
      await db
        .prepare("UPDATE exam_sessions SET last_active_at = unixepoch() WHERE id = ?")
        .bind(session_id)
        .run();
    }

    // Check if session was deleted / kicked by teacher
    const current = await db
      .prepare("SELECT id, status FROM exam_sessions WHERE id = ?")
      .bind(session_id)
      .first<{ id: string; status: string }>();

    if (!current) {
      return NextResponse.json({ kicked: true, message: "คุณถูกครูผู้คุมสอบนำออกจากห้องสอบ" }, { status: 403 });
    }

    return NextResponse.json({ success: true, status: current.status });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
