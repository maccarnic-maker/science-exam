
import { redirect } from "next/navigation";
import { getTeacherSession } from "@/lib/auth-edge";
import PinJoinPortal from "@/components/student/PinJoinPortal";

export const dynamic = "force-dynamic";

export default async function Home() {
  const session = await getTeacherSession();
  if (session) {
    redirect("/teacher/dashboard");
  }

  return <PinJoinPortal />;
}
