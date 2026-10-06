
import { getTeacherSession } from "@/lib/auth-edge";
import { redirect } from "next/navigation";
import TeacherNav from "@/components/teacher/TeacherNav";

// Authentication must run per request even when build-time secrets are absent.
export const dynamic = "force-dynamic";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeacherSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="teacher-nav-shell">
        <TeacherNav user={{ name: session.name, email: session.email, image: session.image }} />
      </div>
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
