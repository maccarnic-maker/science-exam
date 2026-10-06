"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { BookOpen, PlusCircle, QrCode, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import toast from "react-hot-toast";

import CustomModal, { ModalConfig } from "@/components/ui/Modal";

interface Exam {
  id: string;
  title: string;
  subject: string;
  time_limit: number;
  is_active: number;
  question_count: number;
  token: string;
  created_at: number;
}

export default function ExamsListPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: "", message: "" });

  const load = () => {
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
  };

  useEffect(load, []);

  const toggleActive = async (exam: Exam) => {
    const res = await fetch("/api/exams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: exam.id, is_active: !exam.is_active }),
    });
    if (res.ok) {
      toast.success(exam.is_active ? "ปิดการสอบแล้ว" : "เปิดการสอบแล้ว");
      load();
    }
  };

  const confirmDeleteExam = (exam: Exam) => {
    setModalConfig({
      isOpen: true,
      title: "ยืนยันการลบชุดข้อสอบ",
      message: `คุณต้องการลบชุดข้อสอบ "${exam.title}" ใช่หรือไม่?\nข้อมูลคะแนนและการสอบทั้งหมดในชุดนี้จะถูกลบไปด้วย`,
      variant: "danger",
      confirmText: "ลบชุดข้อสอบ",
      cancelText: "ยกเลิก",
      onConfirm: async () => {
        const res = await fetch(`/api/exams?id=${exam.id}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("ลบชุดข้อสอบเรียบร้อยแล้ว");
          load();
        } else {
          toast.error("เกิดข้อผิดพลาดในการลบชุดข้อสอบ");
        }
      },
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-800">ชุดข้อสอบทั้งหมด 📚</h1>
          <p className="text-slate-500 mt-1">จัดการชุดข้อสอบออนไลน์</p>
        </div>
        <Link href="/teacher/exams/new" className="btn-primary flex items-center gap-2">
          <PlusCircle className="w-5 h-5" /> สร้างใหม่
        </Link>
      </div>

      {loading ? (
        <div className="card text-center py-12 text-slate-400">กำลังโหลด...</div>
      ) : exams.length === 0 ? (
        <div className="card text-center py-20">
          <BookOpen className="w-20 h-20 text-slate-200 mx-auto mb-4" />
          <p className="text-slate-400 text-lg mb-4">ยังไม่มีชุดข้อสอบ</p>
          <Link href="/teacher/exams/new" className="btn-primary inline-flex items-center gap-2">
            <PlusCircle className="w-5 h-5" /> สร้างชุดข้อสอบแรก
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {exams.map((exam) => (
            <div key={exam.id} className="card hover:shadow-md transition-all duration-200 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1">
                  <span className={exam.is_active ? "badge-active" : "badge-inactive"}>
                    {exam.is_active ? "🟢 เปิดสอบ" : "⭕ ปิดอยู่"}
                  </span>
                  <span className="text-xs text-slate-400">{exam.subject}</span>
                </div>
                <h3 className="text-lg font-bold text-slate-800">{exam.title}</h3>
                <p className="text-sm text-slate-400 mt-1">
                  {exam.question_count ?? 0} ข้อ · {exam.time_limit} นาที · รหัส: <span className="font-mono font-bold text-blue-600">{exam.token}</span>
                </p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* QR Code */}
                <Link href={`/teacher/exams/${exam.id}?tab=qr`}
                  className="flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                  <QrCode className="w-4 h-4" /> QR / ลิงค์
                </Link>
                {/* Edit */}
                <Link href={`/teacher/exams/${exam.id}`}
                  className="flex items-center gap-1 bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-lg text-sm font-semibold transition-colors">
                  <Pencil className="w-4 h-4" /> แก้ไข
                </Link>
                {/* Toggle */}
                <button onClick={() => toggleActive(exam)}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold transition-colors
                    ${exam.is_active ? "bg-green-50 hover:bg-green-100 text-green-700" : "bg-slate-100 hover:bg-slate-200 text-slate-600"}`}>
                  {exam.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {exam.is_active ? "ปิดสอบ" : "เปิดสอบ"}
                </button>
                {/* Delete */}
                <button onClick={() => confirmDeleteExam(exam)}
                  className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
                  title="ลบชุดข้อสอบ">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation Modal */}
      <CustomModal {...modalConfig} />
    </div>
  );
}
