export const runtime = 'edge';

import { getTeacherSession } from "@/lib/auth-edge";
import { redirect } from "next/navigation";
import TeacherNav from "@/components/teacher/TeacherNav";

export default async function TeacherLayout({ children }: { children: React.ReactNode }) {
  const session = await getTeacherSession();
  if (!session) redirect("/login");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <TeacherNav user={{ name: session.name, email: session.email, image: session.image }} />
      <main className="max-w-7xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
