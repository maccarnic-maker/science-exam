// lib/db.ts – Cloudflare D1 helper (works both in Pages Functions & local)
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  exec(query: string): Promise<D1Result>;
  batch<T = unknown>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  run<T = unknown>(): Promise<D1Result<T>>;
  all<T = unknown>(): Promise<D1Result<T>>;
}

export interface D1Result<T = unknown> {
  results?: T[];
  success: boolean;
  error?: string;
  meta?: Record<string, unknown>;
}

// Declare global binding (injected by Cloudflare Pages runtime)
declare global {
  // eslint-disable-next-line no-var
  var __D1_DB__: D1Database | undefined;
}

export function getDB(env?: { DB?: D1Database }): D1Database {
  const db = env?.DB ?? (globalThis as { DB?: D1Database }).DB;
  if (!db) throw new Error("D1 database binding not found");
  return db;
}

// ── Exam helpers ────────────────────────────────────────────────────────────

export async function getExamByToken(db: D1Database, token: string) {
  return db
    .prepare("SELECT * FROM exams WHERE token = ? AND is_active = 1")
    .bind(token)
    .first<{
      id: string;
      title: string;
      description: string;
      subject: string;
      time_limit: number;
      token: string;
    }>();
}

export async function getExamClassrooms(db: D1Database, examId: string) {
  return db
    .prepare("SELECT * FROM classrooms WHERE exam_id = ? ORDER BY name")
    .bind(examId)
    .all<{ id: string; name: string; grade: string }>();
}

export async function getExamQuestions(db: D1Database, examId: string) {
  const questions = await db
    .prepare(
      "SELECT * FROM questions WHERE exam_id = ? ORDER BY order_num"
    )
    .bind(examId)
    .all<{
      id: string;
      question_text: string;
      question_image: string | null;
      question_type: string;
      points: number;
      order_num: number;
    }>();

  if (!questions.results) return [];

  const withChoices = await Promise.all(
    questions.results.map(async (q) => {
      const choices = await db
        .prepare(
          "SELECT id, choice_text, choice_image, order_num FROM choices WHERE question_id = ? ORDER BY order_num"
        )
        .bind(q.id)
        .all<{
          id: string;
          choice_text: string;
          choice_image: string | null;
          order_num: number;
        }>();
      return { ...q, choices: choices.results ?? [] };
    })
  );

  return withChoices;
}
