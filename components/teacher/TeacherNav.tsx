"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, LayoutDashboard, LogOut, FileCheck2 } from "lucide-react";
import Image from "next/image";

interface Props {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}

export default function TeacherNav({ user }: Props) {
  const path = usePathname();

  const links = [
    { href: "/teacher/dashboard", label: "แดชบอร์ด", icon: LayoutDashboard },
    { href: "/teacher/exams", label: "ชุดข้อสอบ", icon: BookOpen },
  ];

  const handleSignOut = () => {
    window.location.href = "/api/auth/google?action=signout";
  };

  return (
    <nav className="bg-white border-b border-slate-200 shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/teacher/dashboard" className="flex items-center gap-2.5 font-bold text-blue-700 text-lg">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-teal-500 flex items-center justify-center shadow-sm">
            <FileCheck2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <span className="font-extrabold text-slate-800 text-base">ระบบสอบออนไลน์</span>
            <p className="text-[11px] text-slate-400 font-normal leading-tight">รร.บ้านครัว(ซิเมนต์ไทยสงเคราะห์)</p>
          </div>
        </Link>

        {/* Nav links */}
        <div className="flex items-center gap-1">
          {links.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                ${path.startsWith(href)
                  ? "bg-blue-50 text-blue-700"
                  : "text-slate-600 hover:bg-slate-100 hover:text-slate-800"}`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </Link>
          ))}
        </div>

        {/* User + Logout */}
        <div className="flex items-center gap-3">
          {user?.image ? (
            <img
              src={user.image}
              alt={user.name ?? ""}
              width={36}
              height={36}
              className="rounded-full ring-2 ring-blue-200 object-cover"
            />
          ) : (
            <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
              {user?.name ? user.name[0] : "T"}
            </div>
          )}
          <div className="hidden sm:block text-right">
            <p className="text-sm font-semibold text-slate-800">{user?.name}</p>
            <p className="text-xs text-slate-400">{user?.email}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1 text-slate-500 hover:text-red-500 transition-colors ml-2"
            title="ออกจากระบบ"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </nav>
  );
}
