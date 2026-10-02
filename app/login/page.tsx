"use client";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { Suspense } from "react";

function LoginContent() {
  const params = useSearchParams();
  const error = params.get("error");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 p-4">
      {/* Floating science icons background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none select-none">
        {["⚗️","🔬","🧬","🌡️","⚡","🧪","🔭","🌊","🧲","☀️"].map((icon, i) => (
          <span
            key={i}
            className="absolute text-white/10 text-6xl animate-pulse-slow"
            style={{
              left: `${(i * 11 + 5) % 95}%`,
              top: `${(i * 13 + 8) % 90}%`,
              animationDelay: `${i * 0.7}s`,
              fontSize: `${3 + (i % 3)}rem`,
            }}
          >
            {icon}
          </span>
        ))}
      </div>

      {/* Card */}
      <div className="glass rounded-3xl shadow-2xl p-10 w-full max-w-md animate-fade-in relative z-10">
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg mb-4">
            <span className="text-4xl">🔬</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-800">ระบบสอบวิทยาศาสตร์</h1>
          <p className="text-slate-500 text-sm mt-1">โรงเรียนบ้านกรวย</p>
        </div>

        {/* Error alert */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm text-center">
            {error === "unauthorized"
              ? "❌ อีเมลนี้ไม่มีสิทธิ์เข้าใช้งาน กรุณาใช้อีเมลของครู"
              : "⚠️ เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง"}
          </div>
        )}

        <div className="mb-6 text-center">
          <p className="text-slate-600 text-sm">สำหรับครูผู้สอนเท่านั้น</p>
        </div>

        {/* Google Login Button */}
        <button
          onClick={() => signIn("google", { callbackUrl: "/teacher/dashboard" })}
          className="w-full flex items-center justify-center gap-3 bg-white hover:bg-slate-50 
                     border-2 border-slate-200 hover:border-blue-300 text-slate-700 font-semibold 
                     px-6 py-4 rounded-xl transition-all duration-200 shadow-md hover:shadow-lg group"
        >
          <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          <span className="group-hover:text-blue-600 transition-colors">เข้าสู่ระบบด้วย Google</span>
        </button>

        <p className="text-center text-xs text-slate-400 mt-6">
          เฉพาะ <span className="font-semibold text-blue-600">maccarnic@gmail.com</span> เท่านั้น
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
