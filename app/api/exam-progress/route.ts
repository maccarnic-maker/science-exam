export const runtime = 'edge';
import { NextRequest, NextResponse } from 'next/server';
import { getDB } from '@/lib/cloudflare';

export async function POST(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: 'DB not available' }, { status: 503 });
  try {
    if (req.headers.get('origin') !== new URL(req.url).origin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const body = await req.json() as { session_id?: string; revision?: number; answers?: Record<string, string>; current_question?: string; reshuffle?: boolean };
    if (!body.session_id || !Number.isInteger(body.revision) || !body.answers || typeof body.answers !== 'object' || Array.isArray(body.answers)) return NextResponse.json({ error: 'Invalid progress' }, { status: 400 });
    const session = await db.prepare('SELECT question_order, draft_answers, progress_revision, progress_token, status FROM exam_sessions WHERE id = ?').bind(body.session_id).first<{ question_order: string | null; draft_answers: string; progress_revision: number; progress_token: string | null; status: string }>();
    if (!session?.progress_token || req.cookies.get(`exam_progress_${body.session_id}`)?.value !== session.progress_token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (session.status !== 'in_progress' || session.progress_revision !== body.revision) return NextResponse.json({ error: 'Session changed', status: session.status }, { status: 409 });
    const questions = JSON.parse(session.question_order ?? '[]') as { id: string; order_num: number; choices: { id: string }[] }[];
    for (const [id, choice] of Object.entries(body.answers)) {
      if (typeof choice !== 'string' || !questions.find(q => q.id === id)?.choices.some(c => c.id === choice)) return NextResponse.json({ error: 'Invalid answer' }, { status: 400 });
    }
    if (body.reshuffle) {
      const merged = { ...JSON.parse(session.draft_answers), ...body.answers };
      const free = questions.filter(q => !merged[q.id] && q.id !== body.current_question);
      for (let i = free.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [free[i], free[j]] = [free[j], free[i]];
      }
      let index = 0;
      const reordered = questions.map((q, i) => ({ ...(merged[q.id] || q.id === body.current_question ? q : free[index++]), order_num: i + 1 }));
      await db.prepare("UPDATE exam_sessions SET draft_answers = json_patch(draft_answers, ?), question_order = ? WHERE id = ? AND progress_revision = ? AND progress_token = ? AND status = 'in_progress'").bind(JSON.stringify(body.answers), JSON.stringify(reordered), body.session_id, body.revision, session.progress_token).run();
    } else {
      await db.prepare("UPDATE exam_sessions SET draft_answers = json_patch(draft_answers, ?), last_active_at = unixepoch() WHERE id = ? AND progress_revision = ? AND progress_token = ? AND status = 'in_progress'").bind(JSON.stringify(body.answers), body.session_id, body.revision, session.progress_token).run();
    }
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Unable to save progress' }, { status: 500 });
  }
}
