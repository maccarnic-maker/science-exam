"use client";
import { useEffect, useState, Suspense } from "react";
import { printDocument } from '@/lib/print-document';
import { shuffle } from '@/lib/question-pool';
import { useSearchParams, useParams } from "next/navigation";
import { PlusCircle, QrCode, Pencil, Trash2, ToggleLeft, ToggleRight, ArrowLeft, BookOpen, Users, AlertTriangle, UserX, RefreshCw, Shuffle, Printer, ClipboardList, Save } from "lucide-react";
import Link from "next/link";
import toast from "react-hot-toast";
import QuestionEditor from "@/components/teacher/QuestionEditor";
import QRModal from "@/components/teacher/QRModal";
import ScoreReportModal from "@/components/teacher/ScoreReportModal";
import CustomModal, { ModalConfig } from "@/components/ui/Modal";

interface Choice { id: string; choice_text: string; choice_image?: string; is_correct: number; order_num: number }
interface Question { id: string; question_text: string; question_image?: string; question_type: string; points: number; order_num: number; choices: Choice[] }
interface Classroom { id: string; name: string; grade: string }
interface Exam { id: string; title: string; subject: string; time_limit: number; draw_count: number | null; is_active: number; token: string; description: string }
interface Result {
  id: string;
  student_name: string;
  student_number: string;
  classroom_name: string;
  score: number | null;
  total_points: number | null;
  started_at: number;
  submitted_at: number | null;
  last_active_at: number | null;
  tab_switches: number;
  status: string;
}

const TABS = ["ข้อสอบ", "ผลสอบและพฤติกรรม"] as const;
const LABELS = ["ก", "ข", "ค", "ง", "จ", "ฉ"];

function ExamDetailContent({ params }: { params: { id: string } }) {
  const searchParams = useSearchParams();
  const [exam, setExam] = useState<Exam | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [offlineQuestions, setOfflineQuestions] = useState<Question[]>([]);
  useEffect(() => { setOfflineQuestions(shuffle(questions).slice(0, exam?.draw_count ?? questions.length)); }, [questions, exam?.draw_count]);
  const [results, setResults] = useState<Result[]>([]);
  const [tab, setTab] = useState<(typeof TABS)[number]>("ข้อสอบ");
  const [addingQ, setAddingQ] = useState(false);
  const [editQ, setEditQ] = useState<Question | null>(null);
  const [showQR, setShowQR] = useState(searchParams.get("tab") === "qr");
  const [loading, setLoading] = useState(true);
  const [timeLimitDraft, setTimeLimitDraft] = useState("");
  const [drawCountDraft, setDrawCountDraft] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: "", message: "" });
  const [showReportModal, setShowReportModal] = useState(false);

  const { id } = params;

  const loadExam = async () => {
    const [eRes, qRes] = await Promise.all([
      fetch(`/api/exams`),
      fetch(`/api/questions?exam_id=${id}`),
    ]);
    if (eRes.ok) {
      const exams: Exam[] = await eRes.json();
      const found = exams.find((e) => e.id === id);
      setExam(found ?? null);
      setTimeLimitDraft(found ? String(found.time_limit) : "");
      setDrawCountDraft(found?.draw_count ? String(found.draw_count) : '');
    }
    if (qRes.ok) {
      setQuestions(await qRes.json());
    }
    setLoading(false);
  };

  const loadClassrooms = async () => {
    const res = await fetch(`/api/classrooms?exam_id=${id}`);
    if (res.ok) setClassrooms(await res.json());
  };

  const loadResults = async () => {
    const res = await fetch(`/api/results?exam_id=${id}`);
    if (res.ok) {
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
    }
  };

  useEffect(() => { loadExam(); loadClassrooms(); loadResults(); }, [id]);
  
  // Real-time polling when viewing student behavior and results tab
  useEffect(() => {
    if (tab === "ผลสอบและพฤติกรรม") {
      loadResults();
      const timer = setInterval(loadResults, 3000); // อัปเดตพฤติกรรมทุก 3 วินาที
      return () => clearInterval(timer);
    }
  }, [tab, id]);

  const toggleActive = async () => {
    if (!exam) return;
    const res = await fetch("/api/exams", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: !exam.is_active }),
    });
    if (res.ok) {
      setExam((prev) => prev ? { ...prev, is_active: prev.is_active ? 0 : 1 } : null);
      toast.success(exam.is_active ? "ปิดการสอบแล้ว" : "เปิดการสอบแล้ว");
    }
  };

  const saveExamSettings = async () => {
    if (!exam || savingSettings) return;
    const count = Number(drawCountDraft);
    if (!Number.isInteger(count) || count < 1 || count > questions.length) {
      toast.error(`จำนวนข้อที่ใช้สอบต้องเป็นจำนวนเต็มระหว่าง 1 ถึง ${questions.length} ข้อ`);
      return;
    }
    const timeLimit = Number(timeLimitDraft);
    if (!Number.isInteger(timeLimit) || timeLimit < 1 || timeLimit > 300) {
      toast.error("เวลาสอบต้องเป็นจำนวนเต็มระหว่าง 1 ถึง 300 นาที");
      return;
    }

    setSavingSettings(true);
    try {
      const res = await fetch("/api/exams", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, draw_count: count, time_limit: timeLimit }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        toast.error(err.error ?? "บันทึกการตั้งค่าสอบไม่สำเร็จ");
        return;
      }
      setExam((prev) => prev ? { ...prev, draw_count: count, time_limit: timeLimit } : null);
      setDrawCountDraft(String(count));
      setTimeLimitDraft(String(timeLimit));
      toast.success("บันทึกจำนวนข้อและเวลาสอบเรียบร้อยแล้ว");
    } catch {
      toast.error("ไม่สามารถเชื่อมต่อเพื่อบันทึกการตั้งค่าสอบได้");
    } finally {
      setSavingSettings(false);
    }
  };

  const printOfflineExam = (mode: "questions" | "answers") => {
    if (questions.length === 0) {
      toast.error("ยังไม่มีข้อสอบสำหรับพิมพ์");
      return;
    }

    const printClass = mode === "questions" ? "print-offline-questions" : "print-offline-answers";
    document.body.classList.add(printClass);
    printDocument([mode === 'questions' ? 'โจทย์ข้อสอบ' : 'กระดาษคำตอบ', exam?.title ?? 'ชุดข้อสอบ'], () => {
      document.body.classList.remove("print-offline-questions", "print-offline-answers");
    });
  };

  const deleteQuestion = (qId: string) => {
    setModalConfig({
      isOpen: true,
      title: "ยืนยันการลบข้อสอบ",
      message: "คุณต้องการลบข้อสอบข้อนี้ใช่หรือไม่?",
      variant: "danger",
      confirmText: "ลบข้อสอบ",
      cancelText: "ยกเลิก",
      onConfirm: async () => {
        const res = await fetch(`/api/questions?id=${qId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success("ลบข้อสอบเรียบร้อยแล้ว");
          loadExam();
        } else {
          toast.error("เกิดข้อผิดพลาดในการลบข้อสอบ");
        }
      },
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  };

  const deleteStudent = (sessionId: string, studentName: string) => {
    setModalConfig({
      isOpen: true,
      title: "ยืนยันการลบนักเรียน",
      message: `ต้องการลบนักเรียน "${studentName}" ออกจากรอบสอบนี้ใช่หรือไม่?\n\n(นักเรียนจะถูกตัดออกจากห้องสอบทันที)`,
      variant: "danger",
      confirmText: "ลบนักเรียน",
      cancelText: "ยกเลิก",
      onConfirm: async () => {
        const res = await fetch(`/api/results?session_id=${sessionId}`, { method: "DELETE" });
        if (res.ok) {
          toast.success(`ลบ ${studentName} ออกจากห้องสอบแล้ว`);
          loadResults();
        } else {
          toast.error("เกิดข้อผิดพลาดในการลบนักเรียน");
        }
      },
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  };

  const reshuffleStudentExam = (sessionId: string, studentName: string) => {
    setModalConfig({
      isOpen: true,
      title: "สุ่มข้อสอบใหม่ให้นักเรียน",
      message: `คุณต้องการสุ่มชุดข้อสอบใหม่ให้นักเรียน "${studentName}" ใช่หรือไม่?\n\n• คำตอบที่ทำค้างไว้จะถูกล้างออก\n• ระบบจะสุ่มจากคลังทั้งหมดตามจำนวนข้อที่ตั้งไว้\n• เริ่มเวลาและนับพฤติกรรมใหม่ โดยเลือกข้อที่ยังไม่เคยเห็นก่อน`,
      variant: "warning",
      confirmText: "สุ่มข้อสอบใหม่",
      cancelText: "ยกเลิก",
      onConfirm: async () => {
        const res = await fetch(`/api/results?session_id=${sessionId}&action=reshuffle`, {
          method: "PUT",
        });
        if (res.ok) {
          toast.success(`ส่งคำสั่งสุ่มข้อสอบใหม่ให้ ${studentName} แล้ว`);
          loadResults();
        } else {
          toast.error("เกิดข้อผิดพลาดในการสุ่มข้อสอบ");
        }
      },
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  };

  if (loading) return <div className="card text-center py-16 text-slate-400">กำลังโหลด...</div>;
  if (!exam) return <div className="card text-center py-16 text-slate-400">ไม่พบชุดข้อสอบ</div>;

  const answerChoiceCount = Math.max(1, ...offlineQuestions.map((question) => question.choices.length));
  const answerChoiceLabels = LABELS.slice(0, answerChoiceCount);
  const answerSheetGridStyle = { gridTemplateColumns: `10mm repeat(${answerChoiceCount}, minmax(0, 1fr))` };
  const answerGroups = Array.from(
    { length: Math.ceil(offlineQuestions.length / 10) },
    (_, groupIndex) => offlineQuestions.slice(groupIndex * 10, groupIndex * 10 + 10),
  );

  return (
    <>
    <div className="exam-page-content animate-fade-in">
      <div className="mb-4">
        <Link href="/teacher/exams" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-blue-600 transition-colors">
          <ArrowLeft className="w-4 h-4" /> กลับหน้ารายการข้อสอบ
        </Link>
      </div>

      {/* Exam Header */}
      <div className="card mb-6">
        <div className="flex flex-wrap gap-4 items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className={exam.is_active ? "badge-active" : "badge-inactive"}>
                {exam.is_active ? "🟢 เปิดสอบอยู่" : "⭕ ปิดอยู่"}
              </span>
              <span className="text-xs text-slate-400">{exam.subject}</span>
              <span className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                🎲 สุ่มข้อสอบและตัวเลือกอัตโนมัติ
              </span>
            </div>
            <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
            {exam.description && <p className="text-slate-500 text-sm mt-1">{exam.description}</p>}
            <p className="text-sm text-slate-400 mt-2">
              คลัง {questions.length} ข้อ · ใช้สอบ {exam.draw_count ?? questions.length} ข้อ · {exam.time_limit} นาที · รหัส: <span className="font-mono font-bold text-blue-600">{exam.token}</span>
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <label htmlFor="exam-draw-count" className="text-xs font-semibold text-slate-600">จำนวนข้อที่ใช้สอบ</label>
              <input id="exam-draw-count" type="number" min={1} max={questions.length} value={drawCountDraft} disabled={savingSettings} onChange={e => setDrawCountDraft(e.target.value)} className="input-field w-24 py-1.5 text-sm" />
              <label htmlFor="exam-time-limit" className="text-xs font-semibold text-slate-600">แก้เวลาสอบ</label>
              <input
                id="exam-time-limit"
                type="number"
                min={1}
                max={300}
                value={timeLimitDraft}
                disabled={savingSettings}
                onChange={(e) => setTimeLimitDraft(e.target.value)}
                className="input-field w-24 py-1.5 text-sm"
                aria-label="เวลาสอบเป็นนาที"
              />
              <span className="text-xs text-slate-400">นาที</span>
              <button
                type="button"
                onClick={saveExamSettings}
                disabled={savingSettings || questions.length === 0}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-blue-50 hover:text-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="w-3.5 h-3.5" /> {savingSettings ? "กำลังบันทึก..." : "บันทึกการตั้งค่าสอบ"}
              </button>
              <span className="text-xs text-slate-500">จำนวนข้อใช้กับรอบใหม่ รอบที่เริ่มแล้วคงชุดเดิม</span>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => printOfflineExam("questions")}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm"
              title="พิมพ์ข้อสอบเพื่อนำไปสอบออฟไลน์">
              <Printer className="w-4 h-4" /> พิมพ์โจทย์
            </button>
            <button onClick={() => printOfflineExam("answers")}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow-sm"
              title="พิมพ์กระดาษคำตอบแยกจากโจทย์">
              <ClipboardList className="w-4 h-4" /> พิมพ์กระดาษคำตอบ
            </button>
            <button onClick={() => setShowQR(true)}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl font-semibold text-sm transition-colors shadow">
              <QrCode className="w-4 h-4" /> QR / ลิงค์ข้อสอบ
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
            className={`px-5 py-2.5 font-semibold text-sm rounded-t-xl transition-colors
              ${tab === t ? "bg-white border border-b-white border-slate-200 text-blue-700 -mb-px shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
            {t === "ข้อสอบ" ? `📝 ${t} (${questions.length})` : `👀 ${t} (${results.length})`}
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
                      <img src={q.question_image} alt="โจทย์" className="w-full h-full object-cover" />
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditQ(q); setAddingQ(false); }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => deleteQuestion(q.id)}
                    className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Choices preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 pl-11">
                {q.choices.map((c, ci) => (
                  <div key={c.id}
                    className={`flex items-center gap-2 p-2 rounded-lg text-sm border
                      ${c.is_correct ? "border-green-300 bg-green-50 text-green-800 font-semibold" : "border-slate-100 bg-slate-50 text-slate-600"}`}>
                    <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs font-bold shadow-xs">
                      {LABELS[ci] ?? ci + 1}
                    </span>
                    <span className="flex-1">{c.choice_text}</span>
                    {c.choice_image && (
                      <img src={c.choice_image} alt="" className="w-8 h-6 object-cover rounded" />
                    )}
                    {c.is_correct === 1 && <span className="text-xs text-green-600 font-bold">✓ คำตอบที่ถูก</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!addingQ && !editQ && (
            <button onClick={() => { setAddingQ(true); setEditQ(null); }}
              className="w-full btn-primary flex items-center justify-center gap-2 py-3">
              <PlusCircle className="w-5 h-5" /> เพิ่มข้อสอบ
            </button>
          )}
        </div>
      )}

      {/* Results & Student Anti-Cheat Monitoring Tab */}
      {tab === "ผลสอบและพฤติกรรม" && (
        <div>
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 animate-pulse"></span>
              <p className="text-sm font-semibold text-slate-700">ตรวจจับพฤติกรรม Real-time (อัปเดตอัตโนมัติทุก 3 วินาที)</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowReportModal(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-300 hover:border-blue-500 hover:bg-blue-50/50 text-slate-700 hover:text-blue-600 rounded-xl text-xs font-semibold shadow-xs transition-colors"
                title="พิมพ์เอกสารรายงานคะแนน หรือดาวน์โหลดเป็น Excel (CSV)"
              >
                <Printer className="w-3.5 h-3.5 text-blue-600" /> พิมพ์ / ส่งออกรายงานคะแนน
              </button>
              <button onClick={loadResults} className="text-xs flex items-center gap-1 text-blue-600 hover:underline px-2 py-1.5">
                <RefreshCw className="w-3.5 h-3.5" /> รีเฟรชข้อมูล
              </button>
            </div>
          </div>

          {results.length === 0 ? (
            <div className="card text-center py-16">
              <Users className="w-16 h-16 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400">ยังไม่มีนักเรียนเข้าห้องสอบ</p>
            </div>
          ) : (
            <div className="card overflow-x-auto p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-500 text-xs">
                    <th className="text-left py-3.5 px-4 font-bold">#</th>
                    <th className="text-left py-3.5 px-4 font-bold">ชื่อ-นามสกุล</th>
                    <th className="text-left py-3.5 px-4 font-bold">เลขที่</th>
                    <th className="text-left py-3.5 px-4 font-bold">ห้อง</th>
                    <th className="text-center py-3.5 px-4 font-bold">สถานะทำข้อสอบ</th>
                    <th className="text-center py-3.5 px-4 font-bold">พฤติกรรมการสลับจอ</th>
                    <th className="text-right py-3.5 px-4 font-bold">คะแนน</th>
                    <th className="text-center py-3.5 px-4 font-bold">จัดการ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {results.map((r, i) => {
                    const isSubmitted = r.status === "completed" || r.submitted_at !== null;
                    const pct = (r.total_points ?? 0) > 0 ? Math.round(((r.score ?? 0) / r.total_points!) * 100) : 0;
                    const hasCheating = (r.tab_switches ?? 0) > 0;

                    return (
                      <tr key={r.id} className={`hover:bg-slate-50 transition-colors ${hasCheating ? "bg-red-50/30" : ""}`}>
                        <td className="py-3.5 px-4 text-slate-400">{i + 1}</td>
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {r.student_name}
                        </td>
                        <td className="py-3.5 px-4 text-slate-500 font-mono">{r.student_number}</td>
                        <td className="py-3.5 px-4 text-slate-500">{r.classroom_name}</td>
                        <td className="py-3.5 px-4 text-center">
                          {isSubmitted ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              ✓ ส่งแล้ว
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full border border-blue-200 animate-pulse">
                              ✍️ กำลังทำข้อสอบ
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          {hasCheating ? (
                            <span className="inline-flex items-center gap-1 text-xs font-bold text-red-700 bg-red-100 px-3 py-1 rounded-full border border-red-300 animate-bounce-short">
                              <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                              สลับหน้าจอ {r.tab_switches} ครั้ง!
                            </span>
                          ) : (
                            <span className="inline-flex items-center text-xs font-medium text-slate-400">
                              ปกติ (ไม่สลับจอ)
                            </span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          {isSubmitted ? (
                            <div>
                              <span className="font-bold text-slate-800">{r.score}/{r.total_points}</span>
                              <span className={`ml-2 font-bold text-xs ${pct >= 70 ? "text-green-600" : pct >= 50 ? "text-yellow-600" : "text-red-500"}`}>
                                ({pct}%)
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">-</span>
                          )}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => reshuffleStudentExam(r.id, r.student_name)}
                              className="inline-flex items-center gap-1 text-xs text-amber-700 hover:text-amber-800 bg-amber-50 hover:bg-amber-100 px-2.5 py-1.5 rounded-lg border border-amber-200 font-semibold transition-colors"
                              title="สุ่มข้อสอบและตัวเลือกใหม่ให้นักเรียนทำใหม่ทันที"
                            >
                              <Shuffle className="w-3.5 h-3.5" /> สุ่มข้อสอบใหม่
                            </button>
                            <button
                              onClick={() => deleteStudent(r.id, r.student_name)}
                              className="inline-flex items-center gap-1 text-xs text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg border border-red-200 font-semibold transition-colors"
                              title="ลบนักเรียนคนนี้ออกจากห้องสอบ"
                            >
                              <UserX className="w-3.5 h-3.5" /> ลบ
                            </button>
                          </div>
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

    </div>

      {/* QR Modal */}
      {showQR && (
        <QRModal
          examId={id}
          examTitle={exam.title}
          examToken={exam.token}
          classrooms={classrooms}
          onClose={() => setShowQR(false)}
        />
      )}

      {/* Score Report Modal */}
      {showReportModal && exam && (
        <ScoreReportModal
          examTitle={exam.title}
          subject={exam.subject}
          timeLimit={exam.time_limit}
          questionCount={exam.draw_count ?? questions.length}
          classrooms={classrooms}
          results={results}
          onClose={() => setShowReportModal(false)}
        />
      )}

      {/* Custom Confirmation / Alert Modal */}
      <CustomModal {...modalConfig} />

      {/* Offline exam papers: questions and answer sheet are printed separately. */}
      <div className="offline-exam-print" aria-hidden="true">
        <section className="offline-exam-print-questions">
          <header className="offline-exam-print-header">
            <h1>โรงเรียนบ้านครัว (ซิเมนต์ไทยสงเคราะห์)</h1>
            <p>แบบทดสอบวิชา {exam.subject}</p>
            <h2>{exam.title}</h2>
            <p className="offline-exam-print-meta">
              จำนวน {offlineQuestions.length} ข้อ · เวลา {exam.time_limit} นาที · คะแนนเต็ม {offlineQuestions.reduce((sum, question) => sum + (question.points || 1), 0)} คะแนน
            </p>
          </header>

          <div className="offline-exam-print-instructions">
            <strong>คำชี้แจง</strong> ให้นักเรียนเลือกคำตอบที่ถูกต้องที่สุดเพียงคำตอบเดียว แล้วทำเครื่องหมายลงในกระดาษคำตอบ
          </div>

          <main className="offline-exam-print-question-list">
            {offlineQuestions.map((question, questionIndex) => (
              <article className="offline-exam-print-question" key={question.id}>
                <div className="offline-exam-print-question-text">
                  <span className="offline-exam-print-number">{questionIndex + 1}.</span>
                  <span>{question.question_text}</span>
                </div>
                {question.question_image && (
                  <img src={question.question_image} alt="ภาพประกอบโจทย์" className="offline-exam-print-question-image" />
                )}
                <div className="offline-exam-print-choices">
                  {question.choices.map((choice, choiceIndex) => (
                    <div className="offline-exam-print-choice" key={choice.id}>
                      <span className="offline-exam-print-choice-label">{LABELS[choiceIndex] ?? choiceIndex + 1}.</span>
                      <span>{choice.choice_text}</span>
                      {choice.choice_image && (
                        <img src={choice.choice_image} alt="ภาพประกอบตัวเลือก" className="offline-exam-print-choice-image" />
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </main>

          <footer className="offline-exam-print-footer">จบข้อสอบ</footer>
        </section>

        <section className="offline-exam-print-answers">
          {Array.from({ length: Math.ceil(answerGroups.length / 6) }, (_, pageIndex) => (
          <div className="offline-answer-sheet" key={`answer-page-${pageIndex}`}>
            <header className="offline-answer-sheet-header">
              <div>
                <h1>กระดาษคำตอบ</h1>
                <p>วิชา {exam.subject} · {exam.title}</p>
                <p className="offline-answer-sheet-meta">จำนวน {offlineQuestions.length} ข้อ · คะแนนเต็ม {offlineQuestions.reduce((sum, question) => sum + (question.points || 1), 0)} คะแนน</p>
              </div>
              <img src="/school-logo.png" alt="ตราโรงเรียนบ้านครัว" className="offline-answer-sheet-logo" />
            </header>

            <div className="offline-answer-sheet-instruction">
              <strong>คำชี้แจง</strong> ให้นักเรียนระบายคำตอบด้วยดินสอหรือปากกา ลงบนวงกลมคำตอบที่ถูกต้องเพียงคำตอบเดียว
            </div>

            <div className="offline-answer-sheet-fields">
              <div className="offline-answer-sheet-field offline-answer-sheet-field-wide">
                <span>ชื่อ-สกุล</span><i />
              </div>
              <div className="offline-answer-sheet-field">
                <span>ชั้น</span><i />
              </div>
              <div className="offline-answer-sheet-field">
                <span>เลขที่</span><i />
              </div>
              <div className="offline-answer-sheet-field">
                <span>วันที่</span><i />
              </div>
              <div className="offline-answer-sheet-field">
                <span>วิชา</span><i />
              </div>
            </div>

            <div className="offline-answer-sheet-columns">
              {answerGroups.slice(pageIndex * 6, pageIndex * 6 + 6).map((group, groupIndex) => (
                <section className="offline-answer-sheet-column" key={`answer-group-${groupIndex}`}>
                  <div className="offline-answer-sheet-column-header" style={answerSheetGridStyle}>
                    <span>ข้อ</span>
                    {answerChoiceLabels.map((label) => <span key={label}>{label}</span>)}
                  </div>
                  {group.map((question, questionIndex) => {
                    const number = pageIndex * 60 + groupIndex * 10 + questionIndex + 1;
                    return (
                      <div className="offline-answer-sheet-row" key={question.id} style={answerSheetGridStyle}>
                        <span className="offline-answer-sheet-number">{number}</span>
                        {answerChoiceLabels.map((label, choiceIndex) => (
                          <span
                            className={question.choices[choiceIndex] ? "offline-answer-sheet-bubble" : "offline-answer-sheet-bubble offline-answer-sheet-bubble-empty"}
                            key={`${question.id}-${label}`}
                            aria-label={`${number} ${label}`}
                          />
                        ))}
                      </div>
                    );
                  })}
                </section>
              ))}
            </div>

            <footer className="offline-answer-sheet-footer">กระดาษคำตอบสำหรับการสอบออฟไลน์ · โรงเรียนบ้านครัว (ซิเมนต์ไทยสงเคราะห์) · หน้า {pageIndex + 1}/{Math.ceil(answerGroups.length / 6)}</footer>
          </div>
          ))}
        </section>
      </div>
    </>
  );
}

export default function ExamDetailPageWrapper() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-400">กำลังโหลด...</div>}>
      <ExamDetailContent params={params} />
    </Suspense>
  );
}
