// app/api/classrooms/route.ts
import { NextRequest, NextResponse } from "next/server";

type DB = {
  prepare: (q: string) => {
    bind: (...v: unknown[]) => { all: () => Promise<{ results?: unknown[] }> };
  };
};

function getDB(req: NextRequest): DB | undefined {
  return (req as NextRequest & { env?: { DB?: DB } }).env?.DB;
}

export async function GET(req: NextRequest) {
  const db = getDB(req);
  if (!db) return NextResponse.json({ error: "DB not available" }, { status: 500 });

  const { searchParams } = new URL(req.url);
  const examId = searchParams.get("exam_id");
  if (!examId) return NextResponse.json({ error: "Missing exam_id" }, { status: 400 });

  const result = await db
    .prepare("SELECT * FROM classrooms WHERE exam_id = ? ORDER BY grade, name")
    .bind(examId)
    .all();

  return NextResponse.json(result.results ?? []);
}
