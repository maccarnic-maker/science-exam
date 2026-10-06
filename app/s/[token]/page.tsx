
import { redirect, notFound } from "next/navigation";
import { getDB } from "@/lib/cloudflare";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ShortRedirectPage({ params, searchParams }: Props) {
  const { token } = await params;
  const db = getDB();

  if (!db) {
    notFound();
  }

  const exam = await db
    .prepare("SELECT id, is_active FROM exams WHERE (token = ? OR id = ?) AND is_active = 1")
    .bind(token, token)
    .first<{ id: string; is_active: number }>();

  if (!exam) {
    // If not found or inactive, redirect to join page with error or show friendly notice
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-8 max-w-sm w-full text-center text-white">
          <div className="text-5xl mb-4">🔍</div>
          <h1 className="text-xl font-bold mb-2">ไม่พบชุดข้อสอบ</h1>
          <p className="text-slate-300 text-sm mb-6">
            รหัส &ldquo;{token}&rdquo; อาจไม่ถูกต้อง หรือครูปิดการสอบชุดนี้แล้ว
          </p>
          <a
            href="/"
            className="btn-primary inline-block w-full py-3 text-center"
          >
            กลับสู่หน้าหลัก / กรอกรหัสใหม่
          </a>
        </div>
      </div>
    );
  }

  // Preserve query parameters (e.g. cls)
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") {
      qs.set(key, value);
    } else if (Array.isArray(value) && value.length > 0) {
      qs.set(key, value[0]);
    }
  }

  const destination = `/exam/${exam.id}${qs.toString() ? `?${qs.toString()}` : ""}`;
  redirect(destination);
}
