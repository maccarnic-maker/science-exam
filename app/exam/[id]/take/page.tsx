"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronLeft, ChevronRight, CheckCircle, AlertCircle } from "lucide-react";
import Image from "next/image";
import toast from "react-hot-toast";

interface Choice { id: string; choice_text: string; choice_image?: string; order_num: number }
interface Question { id: string; question_text: string; question_image?: string; points: number; order_num: number; choices: Choice[] }
interface StudentInfo { name: string; number: string; classroom_id: string }

const LABELS = ["ก", "ข", "ค", "ง", "จ", "ฉ"];

export default function TakeExamPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [current, setCurrent] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [scoreResult, setScoreResult] = useState<{ score: number; total: number; percent: number } | null>(null);
  const studentInfo = useRef<StudentInfo | null>(null);
  const timeLimitRef = useRef(60);

  useEffect(() => {
    const info = sessionStorage.getItem("student_info");
    if (!info) { router.replace(`/exam/${params.id}`); return; }
    studentInfo.current = JSON.parse(info);

    const load = async () => {
      const [eRes, qRes] = await Promise.all([
        fetch(`/api/exam-info?id=${params.id}`),
        fetch(`/api/questions/public?exam_id=${params.id}`),
      ]);
      if (!eRes.ok || !qRes.ok) { toast.error("ไม่พบข้อสอบ"); return; }
      const exam = await eRes.json();
      const qs: Question[] = await qRes.json();
      timeLimitRef.current = exam.time_limit;
      setTimeLeft(exam.time_limit * 60);
      setQuestions(qs);
      setLoading(false);
    };
    load();
  }, [params.id, router]);

  // Timer
  useEffect(() => {
    if (loading || submitted) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) { clearInterval(interval); submitExam(); return 0; }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, submitted]);

  const submitExam = useCallback(async () => {
    if (submitting || submitted) return;
    setSubmitting(true);
    const info = studentInfo.current;
    if (!info) return;

    const ansArray = Object.entries(answers).map(([question_id, choice_id]) => ({ question_id, choice_id }));

    const res = await fetch("/api/results", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        exam_id: params.id,
        classroom_id: info.classroom_id,
        student_name: info.name,
        student_number: info.number,
        answers: ansArray,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      setScoreResult(data);
      setSubmitted(true);
      sessionStorage.removeItem("student_info");
    } else {
      toast.error("ส่งข้อสอบไม่สำเร็จ กรุณาลองใหม่");
    }
    setSubmitting(false);
  }, [answers, params.id, submitting, submitted]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const q = questions[current];

  // ─── Submitted screen ───────────────────────────────────────────────────────
  if (submitted && scoreResult) {
    const grade = scoreResult.percent >= 80 ? "A" : scoreResult.percent >= 70 ? "B" : scoreResult.percent >= 60 ? "C" : scoreResult.percent >= 50 ? "D" : "F";
    const emoji = scoreResult.percent >= 70 ? "🎉" : scoreResult.percent >= 50 ? "😊" : "📚";
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700 flex items-center justify-center p-4">
        <div className="glass rounded-3xl shadow-2xl p-10 w-full max-w-md text-center animate-fade-in">
          <div className="text-6xl mb-4">{emoji}</div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">ส่งข้อสอบสำเร็จ!</h1>
          <p className="text-slate-500 mb-6">{studentInfo.current?.name}</p>

          <div className="bg-gradient-to-br from-blue-50 to-teal-50 rounded-2xl p-6 mb-6">
            <p className="text-5xl font-bold text-blue-700 mb-1">{scoreResult.score}<span className="text-2xl text-slate-400">/{scoreResult.total}</span></p>
            <p className="text-slate-500 text-sm">คะแนน</p>
            <div className="flex items-center justify-center gap-4 mt-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-teal-600">{scoreResult.percent}%</p>
                <p className="text-xs text-slate-400">เปอร์เซ็นต์</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-purple-600">{grade}</p>
                <p className="text-xs text-slate-400">เกรด</p>
              </div>
            </div>
          </div>
          <p className="text-slate-400 text-sm">ขอบคุณที่เข้าสอบ 🙏</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 to-teal-700 flex items-center justify-center">
        <p className="text-white text-lg animate-pulse">กำลังโหลดข้อสอบ...</p>
      </div>
    );
  }

  // ─── Exam screen ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* Top bar */}
      <div className={`sticky top-0 z-40 shadow-md ${timeLeft < 60 ? "bg-red-600" : "bg-blue-700"} text-white`}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <CheckCircle className="w-4 h-4" />
            <span>ตอบแล้ว {answeredCount}/{questions.length}</span>
          </div>
          <div className={`flex items-center gap-2 font-bold text-lg tabular-nums ${timeLeft < 60 ? "animate-pulse" : ""}`}>
            <Clock className="w-5 h-5" />
            {formatTime(timeLeft)}
          </div>
          <p className="text-sm font-semibold">ข้อ {current + 1}/{questions.length}</p>
        </div>
        {/* Progress bar */}
        <div className="h-1 bg-white/20">
          <div className="h-1 bg-white transition-all duration-500"
            style={{ width: `${(answeredCount / Math.max(questions.length, 1)) * 100}%` }} />
        </div>
      </div>

      {/* Question */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-6">
        {q && (
          <div className="animate-slide-up">
            {/* Question card */}
            <div className="card mb-4">
              <div className="flex items-start gap-3">
                <span className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold flex-shrink-0">
                  {current + 1}
                </span>
                <div className="flex-1">
                  <p className="text-lg font-semibold text-slate-800 leading-relaxed">{q.question_text}</p>
                  {q.question_image && (
                    <div className="mt-3 relative w-full max-w-sm h-48 rounded-xl overflow-hidden border border-slate-200">
                      <Image src={q.question_image} alt="โจทย์" fill className="object-contain bg-white" />
                    </div>
                  )}
                  <p className="text-xs text-blue-500 mt-2 font-semibold">{q.points} คะแนน</p>
                </div>
              </div>
            </div>

            {/* Choices */}
            <div className="space-y-3">
              {q.choices.map((c, ci) => {
                const selected = answers[q.id] === c.id;
                return (
                  <button key={c.id} onClick={() => setAnswers((p) => ({ ...p, [q.id]: c.id }))}
                    className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all duration-200
                      ${selected
                        ? "border-blue-500 bg-blue-50 shadow-md"
                        : "border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50/50"}`}>
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0 transition-colors
                      ${selected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}>
                      {LABELS[ci] ?? ci + 1}
                    </span>
                    {c.choice_image && (
                      <div className="relative w-16 h-14 rounded-lg overflow-hidden flex-shrink-0 border border-slate-200">
                        <Image src={c.choice_image} alt="" fill className="object-cover" />
                      </div>
                    )}
                    <span className={`font-semibold text-base ${selected ? "text-blue-800" : "text-slate-700"}`}>
                      {c.choice_text}
                    </span>
                    {selected && <CheckCircle className="w-5 h-5 text-blue-500 ml-auto flex-shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Skip warning */}
            {!answers[q.id] && (
              <div className="flex items-center gap-2 mt-3 text-amber-600 text-sm">
                <AlertCircle className="w-4 h-4" /> ยังไม่ได้เลือกคำตอบ
              </div>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="sticky bottom-0 bg-white border-t border-slate-200 shadow-lg">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          <button onClick={() => setCurrent((p) => Math.max(0, p - 1))} disabled={current === 0}
            className="btn-secondary flex items-center gap-1 py-3 px-5 disabled:opacity-40">
            <ChevronLeft className="w-5 h-5" /> ก่อนหน้า
          </button>

          {/* Dot navigator */}
          <div className="flex-1 flex flex-wrap justify-center gap-1.5">
            {questions.map((q2, i) => (
              <button key={q2.id} onClick={() => setCurrent(i)}
                className={`w-8 h-8 rounded-lg text-xs font-bold transition-all
                  ${i === current ? "bg-blue-600 text-white scale-110" : answers[q2.id] ? "bg-green-400 text-white" : "bg-slate-200 text-slate-500"}`}>
                {i + 1}
              </button>
            ))}
          </div>

          {current < questions.length - 1 ? (
            <button onClick={() => setCurrent((p) => Math.min(questions.length - 1, p + 1))}
              className="btn-primary flex items-center gap-1 py-3 px-5">
              ถัดไป <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button onClick={() => {
              const unanswered = questions.length - answeredCount;
              if (unanswered > 0 && !confirm(`ยังมี ${unanswered} ข้อที่ยังไม่ได้ตอบ ต้องการส่งเลยไหม?`)) return;
              submitExam();
            }}
              disabled={submitting}
              className="bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-3 rounded-xl transition-colors shadow-md disabled:opacity-50 flex items-center gap-1">
              <CheckCircle className="w-5 h-5" /> {submitting ? "กำลังส่ง..." : "ส่งข้อสอบ"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
