import { D1Database } from "@/lib/cloudflare";

export const INACTIVE_SESSION_TIMEOUT_SECONDS = 30 * 60; // 30 นาที (1,800 วินาที)

/**
 * ลบรอบสอบของนักเรียนที่ออกจากระบบหรือเด้งออกไปแล้วไม่กลับเข้าทำข้อสอบเกิน 30 นาที
 * โดยจะลบเฉพาะรอบสอบที่ยังทำไม่เสร็จ (status != 'completed')
 * พร้อมลบประวัติคำตอบใน student_answers ที่เกี่ยวข้อง
 */
export async function cleanupInactiveSessions(
  db: D1Database,
  examId?: string
): Promise<number> {
  try {
    if (examId) {
      await db.batch([
        db.prepare(`
          DELETE FROM student_answers
          WHERE session_id IN (
            SELECT id FROM exam_sessions
            WHERE exam_id = ?
              AND status != 'completed'
              AND (unixepoch() - COALESCE(last_active_at, started_at)) > ?
          )
        `).bind(examId, INACTIVE_SESSION_TIMEOUT_SECONDS),
        db.prepare(`
          DELETE FROM exam_sessions
          WHERE exam_id = ?
            AND status != 'completed'
            AND (unixepoch() - COALESCE(last_active_at, started_at)) > ?
        `).bind(examId, INACTIVE_SESSION_TIMEOUT_SECONDS),
      ]);
    } else {
      await db.batch([
        db.prepare(`
          DELETE FROM student_answers
          WHERE session_id IN (
            SELECT id FROM exam_sessions
            WHERE status != 'completed'
              AND (unixepoch() - COALESCE(last_active_at, started_at)) > ?
          )
        `).bind(INACTIVE_SESSION_TIMEOUT_SECONDS),
        db.prepare(`
          DELETE FROM exam_sessions
          WHERE status != 'completed'
            AND (unixepoch() - COALESCE(last_active_at, started_at)) > ?
        `).bind(INACTIVE_SESSION_TIMEOUT_SECONDS),
      ]);
    }
  } catch (err) {
    console.error("cleanupInactiveSessions error:", err);
  }
  return 0;
}
