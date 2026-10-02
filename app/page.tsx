export const runtime = 'edge';

import { redirect } from "next/navigation";
import { getTeacherSession } from "@/lib/auth-edge";

export default async function Home() {
  const session = await getTeacherSession();
  if (session) {
    redirect("/teacher/dashboard");
  } else {
    redirect("/login");
  }
}
