import type { D1Database } from './db';

export interface PoolQuestion {
  id: string; question_text: string; question_image: string | null;
  question_type: string; points: number; order_num: number;
  correct_choice_id?: string;
  topic?: string;
  choices: { id: string; choice_text: string; choice_image: string | null; order_num: number }[];
}

export function shuffle<T>(items: T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const value = new Uint32Array(1);
    // Rejection sampling avoids modulo bias.
    const limit = Math.floor(4294967296 / (i + 1)) * (i + 1);
    do { crypto.getRandomValues(value); } while (value[0] >= limit);
    const j = value[0] % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function loadPool(db: D1Database, examId: string): Promise<PoolQuestion[]> {
  const exam = await db.prepare('SELECT COALESCE(bank_exam_id, id) AS source_id FROM exams WHERE id = ?').bind(examId).first<{ source_id: string }>();
  if (!exam) throw new Error('ไม่พบคลังข้อสอบ');
  const rows = await db.prepare('SELECT id, question_text, question_image, question_type, points, order_num, topic FROM questions WHERE exam_id = ? ORDER BY order_num, id').bind(exam.source_id).all<Omit<PoolQuestion, 'choices'>>();
  const choices = await db.prepare('SELECT c.id, c.question_id, c.choice_text, c.choice_image, c.order_num, c.is_correct FROM choices c JOIN questions q ON q.id = c.question_id WHERE q.exam_id = ? ORDER BY c.order_num').bind(exam.source_id).all<PoolQuestion['choices'][number] & { question_id: string; is_correct: number }>();
  const grouped = new Map<string, PoolQuestion['choices']>();
  const keys = new Map<string, string>();
  for (const { question_id, is_correct, ...choice } of choices.results ?? []) {
    if (is_correct === 1) keys.set(question_id, choice.id);
    const list = grouped.get(question_id) ?? [];
    list.push(choice); grouped.set(question_id, list);
  }
  return (rows.results ?? []).map(q => ({ ...q, correct_choice_id: keys.get(q.id), choices: grouped.get(q.id) ?? [] }));
}

export function publicQuestions(questions: PoolQuestion[]) {
  return questions.map(({ correct_choice_id: _key, ...question }) => question);
}

export function drawQuestions(pool: PoolQuestion[], count: number, seen: string[] = [], fixed: PoolQuestion[] = []): PoolQuestion[] {
  if (!Number.isInteger(count) || count < fixed.length || count > pool.length) throw new Error('จำนวนข้อสอบเกินคลังที่มี');
  const excluded = new Set(fixed.map(q => q.id));
  const history = new Set(seen);
  const available = pool.filter(q => !excluded.has(q.id));
  const quotas = new Map<string, number>();
  const used = new Map<string, number>();
  const topic = (q: PoolQuestion) => q.topic ?? 'เนื้อหาเดิม';
  pool.forEach(q => quotas.set(topic(q), (quotas.get(topic(q)) ?? 0) + count / pool.length));
  fixed.forEach(q => used.set(topic(q), (used.get(topic(q)) ?? 0) + 1));
  const result: PoolQuestion[] = [];
  // Draw unseen first; within each tier preserve the pool's topic proportions.
  for (const tier of [shuffle(available.filter(q => !history.has(q.id))), shuffle(available.filter(q => history.has(q.id)))]) {
    while (tier.length && result.length < count - fixed.length) {
      let best = 0;
      for (let i = 1; i < tier.length; i++) {
        const deficit = (q: PoolQuestion) => (quotas.get(topic(q)) ?? 0) - (used.get(topic(q)) ?? 0);
        if (deficit(tier[i]) > deficit(tier[best])) best = i;
      }
      const [selected] = tier.splice(best, 1);
      used.set(topic(selected), (used.get(topic(selected)) ?? 0) + 1);
      result.push({ ...selected, choices: shuffle(selected.choices) });
    }
  }
  return result;
}
