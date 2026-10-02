"use client";
export const runtime = 'edge';
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlusCircle, QrCode, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowLeft, BookOpen, Users } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import QuestionEditor from "@/components/teacher/QuestionEditor";
import QRModal from "@/components/teacher/QRModal";
import Image from "next/image";

interface Choice { id: string; choice_text: string; choice_image?: string; is_correct: number; order_num: number }
interface Question { id: string; question_text: string; question_image?: string; question_type: string; points: number; order_num: number; choices: Choice[] }
interface Classroom { id: string; name: string; grade: string }
interface Exam { id: string; title: string; subject: string; time_limit: number; is_active: number; token: string; description: string }
interface Result { id: string; student_name: string; student_number: string; classroom_name: string; score: number; total_points: number; submitted_at: number }

const TABS = ["ข้อสอบ", "ผลสอบ"] as const;
const LABELS = ["ก", "ข", "ค", "ง", "จ", "ฉ"];

function ExamDetailContent({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("ข้อสอบ");
  const [addingQ, setAddingQ] = useState(false);
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [showQR, setShowQR] = useState(searchParams.get("tab") === "qr");
  const [loading, setLoading] = useState(true);

  const { id } = params;

  const loadExam = async () => {
    const [eRes, qRes, cRes] = await Promise.all([
      fetch(`/api/exams`),
      fetch(`/api/questions?exam_id=${id}`),
      fetch(`/api/exams`), // reuse
    ]);
    const exams: Exam[] = await eRes.json();
    const found = exams.find((e) => e.id === id);
    setExam(found ?? null);
    setQuestions(await qRes.json());
    setLoading(false);
  };

  const loadClassrooms = async () => {
    const res = await fetch(`/api/classrooms?exam_id=${id}`);
    if (res.ok) setClassrooms(await res.json());
  };

  const loadResults = async () => {
    const res = await fetch(`/api/results?exam_id=${id}`);
    if (res.ok) setResults(await res.json());
  };

  useEffect(() => { loadExam(); loadClassrooms(); }, [id]);
  useEffect(() => { if (tab === "ผลสอบ") loadResults(); }, [tab]);

  const toggleActive = async () => {
    if (!exam) return;
    await fetch("/api/exams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: exam.id, is_active: !exam.is_active }),
    });
    toast.success(exam.is_active ? "ปิดการสอบแล้ว" : "เปิดการสอบแล้ว!");
    loadExam();
  };

  const deleteQ = async (qId: string) => {
    if (!confirm("ลบข้อนี้?")) return;
    await fetch(`/api/questions?id=${qId}`, { method: "DELETE" });
    toast.success("ลบแล้ว");
    loadExam();
  };

  if (loading) return <div className="card text-center py-20 text-slate-400">กำลังโหลด...</div>;
  if (!exam) return <div className="card text-center py-20 text-slate-400">ไม่พบชุดข้อสอบ</div>;

  return (
    <div className="animate-fade-in">
      {/* Back */}
      <Link href="/teacher/exams" className="inline-flex items-center gap-1 text-slate-500 hover:text-blue-600 mb-6 text-sm font-semibold">
        <ArrowLeft className="w-4 h-4" /> ชุดข้อสอบทั้งหมด
      </Link>

      {/* Exam Header */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={exam.is_active ? "badge-active" : "badge-inactive"}>
                {exam.is_active ? "🟢 เปิดสอบ" : "⭕ ปิดอยู่"}
              </span>
              <span className="text-xs text-slate-400">{exam.subject}</span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
            {exam.description && <p className="text-slate-500 text-sm mt-1">{exam.description}</p>}
            <p className="text-sm text-slate-400 mt-2">
              {questions.length} ข้อ · {exam.time_limit} นาที · รหัส: <span className="font-mono font-bold text-blue-600">{exam.token}</span>
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setShowQR(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow">
              <QrCode className="w-4 h-4" /> QR / ลิงค์
            </button>
            <button onClick={toggleActive}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-colors
                ${exam.is_active ? "bg-orange-50 text-orange-600 hover:bg-orange-100" : "bg-green-600 text-white hover:bg-green-700 shadow"}`}>
              {exam.is_active ? <><ToggleRight className="w-4 h-4" /> ปิดสอบ</> : <><ToggleLeft className="w-4 h-4" /> เปิดสอบ</>}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 mb-6 gap-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 font-semibold text-sm rounded-t-xl transition-colors
              ${tab === t ? "bg-white border border-b-white border-slate-200 text-blue-700 -mb-px" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "ข้อสอบ" ? `📝 ${t} (${questions.length})` : `📊 ${t} (${results.length})`}
          </button>
        ))}
      </div>

      {/* Questions Tab */}
      {tab === "ข้อสอบ" && (
        <div className="space-y-4">
          {(addingQ || editQ) && (
            <QuestionEditor
              examId={id}
              question={editQ ? {
                ...editQ,
                question_type: editQ.question_type ?? "multiple_choice",
                choices: editQ.choices.map((c) => ({
                  id: c.id, text: c.choice_text, image: c.choice_image,
                  is_correct: c.is_correct === 1, order_num: c.order_num,
                })),
              } : undefined}
              onSaved={() => { setAddingQ(false); setEditQ(null); loadExam(); }}
              onCancel={() => { setAddingQ(false); setEditQ(null); }}
            />
          )}

          {questions.length === 0 && !addingQ && (
            <div className="card text-center py-16">
              <BookOpen className="w-16 h-16 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 mb-4">ยังไม่มีข้อสอบ เพิ่มข้อแรกเลย!</p>
            </div>
          )}

          {questions.map((q, qi) => (
            <div key={q.id} className="card hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <span className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-bold text-sm flex-shrink-0">
                  {qi + 1}
                </span>
                <div className="flex-1">
                  <p className="font-semibold text-slate-800">{q.question_text}</p>
                  {q.question_image && (
                    <div className="mt-2 relative w-48 h-32 rounded-xl overflow-hidden border border-slate-200">
                      <Image src={q.question_image} alt="โจทย์" fill className="object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <span className="text-xs bg-blue-50 text-blue-600 px-2 py-1 rounded-lg font-semibold">{q.points} คะแนน</span>
                  <button onClick={() => { setEditQ(q); setAddingQ(false); }}
                    className="text-slate-400 hover:text-blue-600"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteQ(q.id)}
                    className="text-slate-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 pl-11">
                {q.choices.map((c, ci) => (
                  <div key={c.id} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm
                    ${c.is_correct ? "bg-green-50 border border-green-200 text-green-800 font-semibold" : "bg-slate-50 text-slate-600"}`}>
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                      ${c.is_correct ? "bg-green-500 text-white" : "bg-slate-300 text-slate-600"}`}>
                      {LABELS[ci]}
                    </span>
                    {c.choice_image && (
                      <div className="relative w-8 h-8 rounded overflow-hidden flex-shrink-0">
                        <Image src={c.choice_image} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <span className="truncate">{c.choice_text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!addingQ && !editQ && (
            <button onClick={() => { setAddingQ(true); setEditQ(null); }}
              className="w-full btn-primary flex items-center justify-center gap-2">
              <PlusCircle className="w-5 h-5" /> เพิ่มข้อสอบ
            </button>
          )}
        </div>
      )}

      {/* Results Tab */}
      {tab === "ผลสอบ" && (
        <div>
          {results.length === 0 ? (
            <div className="card text-center py-16">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ยังไม่มีนักเรียนส่งข้อสอบ</p>
            </div>
          ) : (
            <div className="card overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="text-left py-3 px-3 font-semibold">#</th>
                    <th className="text-left py-3 px-3 font-semibold">ชื่อ-นามสกุล</th>
                    <th className="text-left py-3 px-3 font-semibold">เลขที่</th>
                    <th className="text-left py-3 px-3 font-semibold">ห้อง</th>
                    <th className="text-right py-3 px-3 font-semibold">คะแนน</th>
                    <th className="text-right py-3 px-3 font-semibold">%</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r, i) => {
                    const pct = r.total_points > 0 ? Math.round((r.score / r.total_points) * 100) : 0;
                    return (
                      <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50">
                        <td className="py-3 px-3 text-slate-400">{i + 1}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{r.student_name}</td>
                        <td className="py-3 px-3 text-slate-500">{r.student_number}</td>
                        <td className="py-3 px-3 text-slate-500">{r.classroom_name}</td>
                        <td className="py-3 px-3 text-right font-bold text-slate-800">{r.score}/{r.total_points}</td>
                        <td className="py-3 px-3 text-right">
                          <span className={`font-bold ${pct >= 70 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                            {pct}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* QR Modal */}
      {showQR && (
        <QRModal
          examId={id}
          examTitle={exam.title}
          classrooms={classrooms}
          onClose={() => setShowQR(false)}
        />
      )}
    </div>
  );
}

export default function ExamDetailPageWrapper({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">กำลังโหลด...</div>}>
      <ExamDetailContent params={params} />
    </Suspense>
  );
}
