"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, Users, CheckCircle, PlusCircle, TrendingUp, Clock, ArrowRight } from "lucide-react";

interface ExamSummary {
  id: string;
  title: string;
  is_active: number;
  question_count: number;
  draw_count?: number | null;
  pool_count?: number;
  created_at: number;
  subject: string;
  grades: string | null;
  last_opened_at: number | null;
  last_student_started_at: number | null;
  last_student_activity_at?: number | null;
  student_count?: number;
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

  const getStudentActivityTime = (exam: ExamSummary) =>
    exam.last_student_activity_at ?? exam.last_student_started_at ?? 0;

  // เรียงลำดับตามวิชาที่นักเรียนเข้ามาทำล่าสุด
  const recentStudentExams = [...exams]
    .filter((exam) => getStudentActivityTime(exam) > 0 || exam.is_active === 1)
    .sort((a, b) => {
      const timeA = getStudentActivityTime(a);
      const timeB = getStudentActivityTime(b);
      if (timeA !== timeB) return timeB - timeA;
      return (b.created_at ?? 0) - (a.created_at ?? 0);
    });

  const formatThaiDateTime = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

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
          <p className="text-slate-500 mt-1">ระบบสอบออนไลน์ โรงเรียนบ้านครัว(ซิเมนต์ไทยสงเคราะห์)</p>
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
        <div>
          <h2 className="text-xl font-bold text-slate-700">วิชาที่นักเรียนเข้ามาทำล่าสุด</h2>
          <p className="text-xs text-slate-400 mt-0.5">เรียงลำดับตามเวลาที่นักเรียนเข้ามาทำล่าสุด</p>
        </div>
        <Link href="/teacher/exams/new" className="btn-primary flex items-center gap-2 text-sm py-2">
          <PlusCircle className="w-4 h-4" /> สร้างชุดข้อสอบใหม่
        </Link>
      </div>

      {/* Recent Exams */}
      {loading ? (
        <div className="card text-center text-slate-400 py-12">กำลังโหลด...</div>
      ) : recentStudentExams.length === 0 ? (
        <div className="card text-center py-16">
          <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-500 text-lg">ยังไม่มีประวัตินักเรียนเข้าทำข้อสอบ</p>
          <Link href="/teacher/exams" className="btn-primary inline-flex items-center gap-2 mt-4 text-sm py-2">
            <BookOpen className="w-4 h-4" /> ดูชุดข้อสอบทั้งหมด
          </Link>
        </div>
      ) : (
        <div className="grid gap-3">
          {recentStudentExams.slice(0, 5).map((exam) => {
            const studentActivityTime = getStudentActivityTime(exam);
            return (
              <Link key={exam.id} href={`/teacher/exams/${exam.id}`}
                className="card hover:shadow-md transition-all duration-200 hover:border-blue-200 flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 group-hover:text-blue-700">{exam.title}</p>
                    <p className="text-sm text-slate-400">
                      {exam.subject} · {exam.grades || 'ยังไม่ระบุชั้น'} · {exam.question_count ?? 0} ข้อ
                      {Boolean(exam.student_count && exam.student_count > 0) && ` · นักเรียนเข้าทำ ${exam.student_count} คน`}
                    </p>
                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-blue-500" />
                      {studentActivityTime > 0 ? (
                        <span>
                          นักเรียนเข้าทำล่าสุด: <strong className="text-slate-700 font-medium">{formatThaiDateTime(studentActivityTime)} น.</strong>
                        </span>
                      ) : (
                        <span className="text-slate-400">ยังไม่มีนักเรียนเข้าทำ</span>
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={exam.is_active ? "badge-active" : "badge-inactive"}>
                    {exam.is_active ? "เปิดสอบ" : "ปิดอยู่"}
                  </span>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-colors" />
                </div>
              </Link>
            );
          })}
          {exams.length > 0 && (
            <Link href="/teacher/exams" className="text-center text-blue-600 text-sm hover:underline py-2">
              ดูทั้งหมด ({exams.length} ชุด)
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
