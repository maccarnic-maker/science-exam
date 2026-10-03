"use client";
export const runtime = 'edge';
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Clock, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, ShieldAlert } from "lucide-react";
import toast from "react-hot-toast";
import CustomModal, { ModalConfig } from "@/components/ui/Modal";

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
  const [kicked, setKicked] = useState<string | null>(null);
  const [tabSwitchCount, setTabSwitchCount] = useState(0);
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [modalConfig, setModalConfig] = useState<ModalConfig>({ isOpen: false, title: "", message: "" });

  const sessionIdRef = useRef<string | null>(null);
  const studentInfo = useRef<StudentInfo | null>(null);
  const timeLimitRef = useRef(60);
  const submissionStartedRef = useRef(false);
  const submittingRef = useRef(false);
  const submitRetryTimerRef = useRef<number | null>(null);
  const hiddenStateReportedRef = useRef(false);
  const questionsRef = useRef<Question[]>([]);
  const answersRef = useRef<Record<string, string>>({});
  const currentRef = useRef(0);

  const setCurrentQuestion = useCallback((next: number | ((previous: number) => number)) => {
    const nextIndex = typeof next === "function" ? next(currentRef.current) : next;
    currentRef.current = nextIndex;
    setCurrent(nextIndex);
  }, []);

  const selectAnswer = useCallback((questionId: string, choiceId: string) => {
    const nextAnswers = { ...answersRef.current, [questionId]: choiceId };
    answersRef.current = nextAnswers;
    setAnswers(nextAnswers);
  }, []);

  // 1. Initial Load & Fetch Questions with Shuffling
  useEffect(() => {
    const info = sessionStorage.getItem("student_info");
    if (!info) { router.replace(`/exam/${params.id}`); return; }
    studentInfo.current = JSON.parse(info);

    const load = async () => {
      const qParams = new URLSearchParams({
        exam_id: params.id,
        classroom_id: studentInfo.current?.classroom_id ?? "",
        student_name: studentInfo.current?.name ?? "",
        student_number: studentInfo.current?.number ?? "",
      });

      const [eRes, qRes] = await Promise.all([
        fetch(`/api/exam-info?id=${params.id}`),
        fetch(`/api/questions/public?${qParams.toString()}`),
      ]);

      if (!eRes.ok || !qRes.ok) { toast.error("ไม่พบข้อสอบหรือการสอบถูกปิด"); return; }
      const exam = (await eRes.json()) as any;
      const qData = (await qRes.json()) as { session_id?: string; questions?: Question[] };

      sessionIdRef.current = qData.session_id ?? null;
      timeLimitRef.current = exam.time_limit;
      setTimeLeft(exam.time_limit * 60);
      const initialQuestions = qData.questions ?? [];
      questionsRef.current = initialQuestions;
      answersRef.current = {};
      currentRef.current = 0;
      setQuestions(initialQuestions);
      setLoading(false);
    };
    load();
  }, [params.id, router]);

  const reloadShuffledQuestions = useCallback(async (preserveAnswered = false) => {
    const previousQuestions = questionsRef.current;
    const preservedAnswers = answersRef.current;
    const previousCurrent = currentRef.current;
    setLoading(true);

    const qParams = new URLSearchParams({
      exam_id: params.id,
      classroom_id: studentInfo.current?.classroom_id ?? "",
      student_name: studentInfo.current?.name ?? "",
      student_number: studentInfo.current?.number ?? "",
    });

    try {
      const [eRes, qRes] = await Promise.all([
        fetch(`/api/exam-info?id=${params.id}`),
        fetch(`/api/questions/public?${qParams.toString()}`),
      ]);

      if (eRes.ok && qRes.ok) {
        const exam = (await eRes.json()) as any;
        const qData = (await qRes.json()) as { session_id?: string; questions?: Question[] };
        sessionIdRef.current = qData.session_id ?? sessionIdRef.current;
        timeLimitRef.current = exam.time_limit;
        const freshQuestions = qData.questions ?? [];

        if (preserveAnswered && previousQuestions.length === freshQuestions.length) {
          const unansweredQuestions = freshQuestions.filter((question) => !preservedAnswers[question.id]);
          let unansweredIndex = 0;
          const mergedQuestions = previousQuestions.map((previousQuestion, index) => {
            const question = preservedAnswers[previousQuestion.id]
              ? previousQuestion
              : unansweredQuestions[unansweredIndex++] ?? previousQuestion;

            return { ...question, order_num: index + 1 };
          });

          questionsRef.current = mergedQuestions;
          answersRef.current = preservedAnswers;
          currentRef.current = Math.min(previousCurrent, Math.max(mergedQuestions.length - 1, 0));
          setQuestions(mergedQuestions);
          setAnswers(preservedAnswers);
          setCurrent(currentRef.current);
        } else {
          questionsRef.current = freshQuestions;
          answersRef.current = {};
          currentRef.current = 0;
          setQuestions(freshQuestions);
          setAnswers({});
          setCurrent(0);
          setTimeLeft(exam.time_limit * 60);
        }
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }

    if (preserveAnswered) return;

    setModalConfig({
      isOpen: true,
      title: "ครูผู้คุมสอบสั่งสุ่มข้อสอบใหม่!",
      message: "ตรวจพบพฤติกรรมผิดปกติ หรือครูผู้คุมสอบสั่งสลับข้อสอบใหม่ให้คุณ\n\nระบบได้ทำการรีเซ็ตคำตอบและจัดลำดับข้อสอบชุดใหม่ให้เรียบร้อยแล้ว กรุณาเริ่มทำข้อสอบใหม่อีกครั้ง",
      variant: "warning",
      isAlert: true,
      confirmText: "รับทราบ และเริ่มทำใหม่",
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  }, [params.id]);

  // 2. Anti-Cheat: Detect hidden document transitions & real-time commands
  useEffect(() => {
    if (loading || submitted || kicked) return;

    const reportTabSwitch = async () => {
      if (submissionStartedRef.current || !sessionIdRef.current) return;

      setTabSwitchCount((prev) => {
        const next = prev + 1;
        setShowWarningModal(true);
        return next;
      });

      try {
        const res = await fetch("/api/exam-activity", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ session_id: sessionIdRef.current, event_type: "tab_switch" }),
        });
        const data = (await res.json()) as { kicked?: boolean; reshuffle?: boolean; status?: string; message?: string };
        if (data.kicked) {
          setKicked(data.message ?? "คุณถูกครูผู้คุมสอบนำออกจากห้องสอบ");
        } else if (data.reshuffle) {
          reloadShuffledQuestions();
        } else if (data.status !== "completed") {
          await reloadShuffledQuestions(true);
        }
      } catch {
        // ignore network error
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        // A tab switch can emit both blur and visibilitychange. Only count the
        // transition into the hidden state, so one switch is recorded once.
        if (hiddenStateReportedRef.current) return;
        hiddenStateReportedRef.current = true;
        reportTabSwitch();
      } else {
        hiddenStateReportedRef.current = false;
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Heartbeat every 3 seconds to keep live presence & check kick/reshuffle status
    const heartbeatTimer = setInterval(async () => {
      if (submissionStartedRef.current || !sessionIdRef.current) return;

      if (sessionIdRef.current) {
        try {
          const res = await fetch("/api/exam-activity", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ session_id: sessionIdRef.current, event_type: "heartbeat" }),
          });
          const data = (await res.json()) as { kicked?: boolean; reshuffle?: boolean; message?: string };
          if (data.kicked) {
            setKicked(data.message ?? "คุณถูกครูผู้คุมสอบนำออกจากห้องสอบ");
          } else if (data.reshuffle) {
            reloadShuffledQuestions();
          }
        } catch {
          // ignore
        }
      }
    }, 3000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(heartbeatTimer);
    };
  }, [loading, submitted, kicked, reloadShuffledQuestions]);

  useEffect(() => {
    return () => {
      if (submitRetryTimerRef.current !== null) {
        window.clearTimeout(submitRetryTimerRef.current);
      }
    };
  }, []);

  const executeSubmit = useCallback(async (isRetry = false) => {
    if (submitted || kicked || (!isRetry && (submittingRef.current || submissionStartedRef.current))) return;
    setSubmitting(true);
    const info = studentInfo.current;
    if (!info || !sessionIdRef.current) {
      setSubmitting(false);
      return;
    }

    // Stop all client-side activity reporting as soon as submission starts.
    if (!isRetry) submissionStartedRef.current = true;
    submittingRef.current = true;

    const ansArray = Object.entries(answers).map(([question_id, choice_id]) => ({ question_id, choice_id }));
    let submissionSucceeded = false;
    let retryScheduled = false;

    try {
      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionIdRef.current,
          exam_id: params.id,
          classroom_id: info.classroom_id,
          student_name: info.name,
          student_number: info.number,
          answers: ansArray,
        }),
      });

      if (res.ok) {
        const data = (await res.json()) as any;
        setScoreResult(data);
        setSubmitted(true);
        submissionSucceeded = true;
        sessionStorage.removeItem("student_info");
      } else {
        const err = (await res.json()) as any;
        if (res.status === 409 && err.code === "SUBMISSION_IN_PROGRESS") {
          retryScheduled = true;
          const retryAfter = typeof err.retry_after_ms === "number" ? err.retry_after_ms : 1000;
          submitRetryTimerRef.current = window.setTimeout(() => {
            submitRetryTimerRef.current = null;
            void executeSubmit(true);
          }, Math.max(500, Math.min(retryAfter, 3000)));
          return;
        }
        setModalConfig({
          isOpen: true,
          title: "ส่งข้อสอบไม่สำเร็จ",
          message: err.error ?? "เกิดข้อผิดพลาดในการส่งข้อสอบ กรุณาลองใหม่อีกครั้ง",
          variant: "danger",
          isAlert: true,
          confirmText: "ตกลง",
          onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
        });
      }
    } catch {
      setModalConfig({
        isOpen: true,
        title: "เกิดข้อผิดพลาดในการเชื่อมต่อ",
        message: "ไม่สามารถส่งข้อสอบได้ กรุณาตรวจสอบอินเทอร์เน็ตแล้วลองใหม่อีกครั้ง",
        variant: "danger",
        isAlert: true,
        confirmText: "ตกลง",
        onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
      });
    } finally {
      if (!submissionSucceeded && !retryScheduled) {
        submissionStartedRef.current = false;
      }
      if (!retryScheduled) {
        submittingRef.current = false;
        setSubmitting(false);
      }
    }
  }, [answers, params.id, submitted, kicked]);

  const handleManualSubmit = () => {
    const ansCount = Object.keys(answers).length;
    if (ansCount !== questions.length) {
      const firstUnanswered = questions.findIndex((question) => !answers[question.id]);
      if (firstUnanswered >= 0) setCurrentQuestion(firstUnanswered);
      return;
    }

    const confirmMsg = `คุณตอบข้อสอบครบทั้งหมด ${questions.length} ข้อแล้ว\n\nต้องการยืนยันส่งข้อสอบใช่หรือไม่? เมื่อส่งแล้วจะไม่สามารถกลับมาแก้ไขได้`;

    setModalConfig({
      isOpen: true,
      title: "ยืนยันการส่งข้อสอบ",
      message: confirmMsg,
      variant: "info",
      confirmText: "ยืนยันส่งข้อสอบ",
      cancelText: "กลับไปทำต่อ",
      onConfirm: () => {
        executeSubmit();
      },
      onClose: () => setModalConfig((p) => ({ ...p, isOpen: false })),
    });
  };

  // 3. Timer
  useEffect(() => {
    if (loading || submitted || kicked) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(interval);
          executeSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [loading, submitted, kicked, executeSubmit]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60), sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const answeredCount = Object.keys(answers).length;
  const q = questions[current];

  const goToNextUnanswered = () => {
    const nextIndex = questions.findIndex((question, index) => index > currentRef.current && !answersRef.current[question.id]);
    if (nextIndex >= 0) {
      setCurrentQuestion(nextIndex);
      return;
    }

    const firstUnanswered = questions.findIndex((question) => !answersRef.current[question.id]);
    if (firstUnanswered >= 0) setCurrentQuestion(firstUnanswered);
  };

  // ─── Kicked by teacher screen ─────────────────────────────────────────────
  if (kicked) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <div className="glass rounded-3xl p-10 w-full max-w-md text-center bg-red-950/80 border border-red-500/30 text-white">
          <ShieldAlert className="w-20 h-20 text-red-500 mx-auto mb-4 animate-bounce" />
          <h1 className="text-2xl font-bold mb-2">ถูกระงับการสอบ</h1>
          <p className="text-red-200 mb-6">{kicked}</p>
          <p className="text-xs text-slate-400">กรุณาติดต่อครูผู้คุมสอบเพื่อดำเนินการแก้ไข</p>
        </div>
      </div>
    );
  }

  // ─── Submitted screen ───────────────────────────────────────────────────────
  if (submitted && scoreResult) {
    const performanceLevel = scoreResult.percent >= 80
      ? "ดีเยี่ยม"
      : scoreResult.percent >= 70
      ? "ดี"
      : scoreResult.percent >= 60
      ? "ปานกลาง"
      : scoreResult.percent >= 50
      ? "พอใช้"
      : "ควรปรับปรุง";
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
                <p className="text-2xl font-bold text-purple-600">{performanceLevel}</p>
                <p className="text-xs text-slate-400">เกณฑ์ผลการทำแบบทดสอบ</p>
              </div>
            </div>
          </div>

          {tabSwitchCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-xl p-3 text-xs mb-6">
              ⚠️ ตรวจพบการสลับหน้าจอระหว่างทำข้อสอบ: <strong>{tabSwitchCount} ครั้ง</strong> (บันทึกเข้าระบบครูแล้ว)
            </div>
          )}

          <p className="text-xs text-slate-400">ระบบบันทึกผลการสอบเรียบร้อยแล้ว ปิดหน้านี้ได้เลยครับ</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-300">กำลังสุ่มจัดชุดข้อสอบ...</p>
        </div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white p-4">
        <div className="text-center">
          <p className="text-xl">ยังไม่มีข้อสอบในระบบ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col select-none">
      {/* Tab Switch Warning Modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full text-center shadow-2xl border-4 border-red-500 animate-bounce-short">
            <AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-3" />
            <h2 className="text-xl font-bold text-red-600">คำเตือน: ห้ามสลับหน้าจอ!</h2>
            <p className="text-slate-600 text-sm mt-2">
              ระบบตรวจพบว่าคุณสลับหน้าจอหรือย่อแอปพลิเคชัน
            </p>
            <div className="my-4 bg-red-50 text-red-700 py-2 rounded-xl font-bold text-sm">
              บันทึกการสลับหน้าจอ: {tabSwitchCount} ครั้ง
            </div>
            <p className="text-xs text-slate-500 mb-6">
              ระบบจะสุ่มข้อที่ยังไม่ได้ตอบใหม่ทันที รวมถึงข้อที่กำลังเปิดอยู่ตอนตรวจพบการสลับจอ ส่วนข้อที่ตอบแล้วจะคงเดิม
            </p>
            <button
              onClick={() => setShowWarningModal(false)}
              className="btn-primary w-full py-3 bg-red-600 hover:bg-red-700"
            >
              รับทราบ และกลับไปทำข้อสอบ
            </button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 sticky top-0 z-30 shadow-sm flex items-center justify-between">
        <div>
          <p className="font-bold text-slate-800 text-base">{studentInfo.current?.name}</p>
          <p className="text-xs text-slate-400">เลขที่ {studentInfo.current?.number}</p>
        </div>

        {/* Live tab warning badge */}
        {tabSwitchCount > 0 && (
          <div className="hidden sm:flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1 rounded-full text-xs font-semibold border border-red-200">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>สลับจอ {tabSwitchCount} ครั้ง</span>
          </div>
        )}

        {/* Timer */}
        <div className={`flex items-center gap-2 px-4 py-1.5 rounded-full font-mono font-bold text-base
          ${timeLeft < 300 ? "bg-red-50 text-red-600 animate-pulse" : "bg-blue-50 text-blue-700"}`}>
          <Clock className="w-4 h-4" />
          <span>{formatTime(timeLeft)}</span>
        </div>
      </header>

      {/* Main Container */}
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>ข้อ {current + 1} จาก {questions.length}</span>
            <span>ตอบแล้ว {answeredCount}/{questions.length} ข้อ</span>
          </div>
          <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
            <div
              className="bg-blue-600 h-full transition-all duration-300"
              style={{ width: `${((current + 1) / questions.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Question Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-slate-200 flex-1 flex flex-col justify-between mb-4">
          <div>
            <div className="flex items-start gap-3 mb-4">
              <span className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center font-bold text-base flex-shrink-0">
                {current + 1}
              </span>
              <p className="text-lg sm:text-xl font-bold text-slate-800 leading-relaxed pt-0.5">
                {q.question_text}
              </p>
            </div>

            {/* Question Image */}
            {q.question_image && (
              <div className="mb-6 rounded-2xl overflow-hidden border border-slate-200 max-h-72 flex items-center justify-center bg-slate-50">
                <img src={q.question_image} alt="ภาพประกอบโจทย์" className="max-h-72 object-contain" />
              </div>
            )}

            {/* Choices */}
            <div className="grid gap-3">
              {q.choices.map((c, ci) => {
                const isSelected = answers[q.id] === c.id;
                return (
                  <button
                    key={c.id}
                    disabled={submitting}
                    onClick={() => selectAnswer(q.id, c.id)}
                    className={`w-full text-left p-4 rounded-2xl border-2 transition-all flex items-center gap-4 group
                      ${isSelected
                        ? "border-blue-600 bg-blue-50/60 shadow-sm"
                        : "border-slate-200 hover:border-blue-200 hover:bg-slate-50"}`}
                  >
                    <span className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-sm transition-colors
                      ${isSelected ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-700"}`}>
                      {LABELS[ci] ?? ci + 1}
                    </span>
                    <span className="flex-1 text-slate-700 font-medium text-base">{c.choice_text}</span>
                    {c.choice_image && (
                      <div className="w-16 h-12 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                        <img src={c.choice_image} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-100">
            <button
              onClick={() => setCurrentQuestion((c) => Math.max(0, c - 1))}
              disabled={current === 0 || submitting}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-40"
            >
              <ChevronLeft className="w-5 h-5" /> ย้อนกลับ
            </button>

            {answeredCount < questions.length ? (
              <button
                onClick={goToNextUnanswered}
                disabled={submitting}
                className="btn-primary flex items-center gap-1.5 py-2.5 px-6"
              >
                ข้อถัดไป <ChevronRight className="w-5 h-5" />
              </button>
            ) : (
              <button
                onClick={handleManualSubmit}
                disabled={submitting}
                className="btn-primary flex items-center gap-2 py-2.5 px-8 bg-green-600 hover:bg-green-700 shadow-green-200"
              >
                <CheckCircle className="w-5 h-5" /> {submitting ? "กำลังส่ง..." : "ส่งข้อสอบ"}
              </button>
            )}
          </div>
        </div>

        {/* Quick Navigator Grid */}
        <div className="bg-white rounded-2xl p-4 border border-slate-200">
          <p className="text-xs font-semibold text-slate-400 mb-3">ข้ามไปยังข้อ:</p>
          <div className="flex flex-wrap gap-2">
            {questions.map((qu, i) => {
              const isAns = !!answers[qu.id];
              const isCur = current === i;
              return (
                <button
                  key={qu.id}
                  onClick={() => setCurrentQuestion(i)}
                  disabled={submitting}
                  className={`w-9 h-9 rounded-xl font-bold text-sm transition-all
                    ${isCur
                      ? "ring-2 ring-blue-600 bg-blue-600 text-white"
                      : isAns
                      ? "bg-blue-100 text-blue-700"
                      : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirmation & Alert Modal */}
      <CustomModal {...modalConfig} />
    </div>
  );
}
