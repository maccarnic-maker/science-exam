"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, ArrowRight, ShieldCheck, UserCheck } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default function PinJoinPortal() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = pin.trim().toUpperCase();
    if (!cleanPin) {
      setError("กรุณากรอกรหัสข้อสอบ");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/exam-info?code=${encodeURIComponent(cleanPin)}`);
      if (res.ok) {
        const data = (await res.json()) as { id: string };
        router.push(`/exam/${data.id}`);
      } else {
        const err = (await res.json()) as { error?: string };
        setError(err.error ?? "ไม่พบรหัสข้อสอบนี้ หรือครูปิดการสอบแล้ว");
        setLoading(false);
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเชื่อมต่อ กรุณาลองใหม่อีกครั้ง");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex flex-col items-center justify-between p-4 sm:p-6">
      {/* Top Navbar */}
      <div className="w-full max-w-4xl flex items-center justify-between py-2 text-white/90">
        <div className="flex items-center gap-2.5">
          <div className="relative w-9 h-9 rounded-full bg-white p-0.5 shadow-md overflow-hidden">
            <Image
              src="/school-logo-qr.png"
              alt="School Logo"
              width={36}
              height={36}
              className="object-contain"
            />
          </div>
          <div>
            <p className="font-bold text-sm tracking-wide leading-none">ระบบสอบออนไลน์</p>
            <p className="text-[11px] text-blue-200 mt-0.5 leading-none">โรงเรียนบ้านครัว (ซิเมนต์ไทยสงเคราะห์)</p>
          </div>
        </div>

        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl border border-white/20 transition-all font-medium"
        >
          <UserCheck className="w-3.5 h-3.5" />
          สำหรับคุณครู
        </Link>
      </div>

      {/* Main Join Card */}
      <div className="w-full max-w-md my-auto">
        <div className="glass rounded-3xl p-8 sm:p-10 shadow-2xl border border-white/20 text-center animate-fade-in">
          <div className="w-20 h-20 bg-gradient-to-tr from-blue-600 to-teal-400 rounded-3xl mx-auto flex items-center justify-center shadow-lg mb-6 text-white animate-bounce-short">
            <KeyRound className="w-10 h-10" />
          </div>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-800 tracking-tight mb-2">
            เข้าสู่ห้องสอบ
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            กรอกรหัส PIN 6 หลัก จากคุณครูผู้คุมสอบ
          </p>

          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  autoFocus
                  maxLength={12}
                  placeholder="เช่น 583921"
                  value={pin}
                  onChange={(e) => {
                    setPin(e.target.value.replace(/\s+/g, ""));
                    if (error) setError("");
                  }}
                  className="w-full text-center tracking-widest font-mono text-3xl font-extrabold py-3.5 px-4 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border-2 border-slate-300 focus:border-blue-600 rounded-2xl outline-none shadow-inner transition-all placeholder:text-slate-300 placeholder:font-normal placeholder:text-2xl placeholder:tracking-normal"
                />
              </div>
              {error && (
                <p className="text-xs font-semibold text-red-600 mt-2 animate-fade-in">
                  ⚠️ {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading || !pin.trim()}
              className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2 shadow-blue-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span>กำลังตรวจสอบรหัส...</span>
              ) : (
                <>
                  เข้าทำข้อสอบ <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 flex items-center justify-center gap-2 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-teal-600" />
            <span>ระบบบันทึกความซื่อสัตย์และการทำข้อสอบแบบ Real-time</span>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-blue-200/80 py-2">
        <p>© 2026 โรงเรียนบ้านครัว (ซิเมนต์ไทยสงเคราะห์) · สพป.สระบุรี เขต 1</p>
        <p className="mt-1">ผู้พัฒนา: ธันฐกรณ์ เฉลิมวัฒน์ · maccarnic@gmail.com · โทร. 086-130-6013</p>
      </div>
    </div>
  );
}
