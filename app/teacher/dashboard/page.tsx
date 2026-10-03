"use client";
export const runtime = 'edge';
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Users, CheckCircle, PlusCircle, TrendingUp } from "lucide-react";

interface ExamSummary {
  id: string;
  title: string;
  is_active: number;
  question_count: number;
  created_at: number;
}

export default function TeacherDashboard() {
  const [exams, setExams] = useState<ExamSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/exams")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setExams(d);
        } else {
          setExams([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setExams([]);
        setLoading(false);
      });
  }, []);

  const activeCount = exams.filter((e) => e.is_active).length;
  const totalQ = exams.reduce((s, e) => s + (e.question_count ?? 0), 0);

  const stats = [
    { label: "ชุดข้อสอบทั้งหมด", value: exams.length, icon: BookOpen, color: "blue" },
    { label: "กำลังเปิดสอบ", value: activeCount, icon: CheckCircle, color: "green" },
    { label: "จำนวนข้อสอบ", value: totalQ, icon: TrendingUp, color: "purple" },
  ];

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">แดชบอร์ด 👩‍🏫</h1>
          <p className="text-slate-500 mt-1">ระบบสอบวิชาวิทยาศาสตร์ โรงเรียนบ้านครัว(ซิเมนต์ไทยสงเคราะห์)</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="card flex items-center gap-4">
            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
              ${color === "blue" ? "bg-blue-50" : color === "green" ? "bg-green-50" : "bg-purple-50"}`}>
              <Icon className={`w-7 h-7 ${color === "blue" ? "text-blue-600" : color === "green" ? "text-green-600" : "text-purple-600"}`} />
            </div>
            <div>
              <p className="text-3xl font-bold text-slate-800">{loading ? "…" : value}</p>
              <p className="text-sm text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Action */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-700">ชุดข้อสอบล่าสุด</h2>
        <Link href="/teacher/exams/new" className="btn-primary flex items-center gap-2 text-sm py-2">
          <PlusCircle className="w-4 h-4" /> สร้างชุดข้อสอบใหม่
        </Link>
      </div>

      {/* Recent Exams */}
      {loading ? (
        <div className="card text-center text-slate-400 py-12">กำลังโหลด...</div>
      ) : exams.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">ยังไม่มีชุดข้อสอบ</p>
          <Link href="/teacher/exams/new" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm py-2">
            <PlusCircle className="w-4 h-4" /> สร้างชุดข้อสอบแรก
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {exams.slice(0, 5).map((exam) => (
            <Link key={exam.id} href={`/teacher/exams/${exam.id}`}
              className="card hover:shadow-md transition-all duration-200 hover:border-blue-200 flex items-center justify-between group">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 group-hover:text-blue-700">{exam.title}</p>
                  <p className="text-sm text-slate-400">{exam.question_count ?? 0} ข้อ</p>
                </div>
              </div>
              <span className={exam.is_active ? "badge-active" : "badge-inactive"}>
                {exam.is_active ? "เปิดสอบ" : "ปิดอยู่"}
              </span>
            </Link>
          ))}
          {exams.length > 5 && (
            <Link href="/teacher/exams" className="text-center text-blue-600 text-sm hover:underline py-2">
              ดูทั้งหมด ({exams.length} ชุด)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
