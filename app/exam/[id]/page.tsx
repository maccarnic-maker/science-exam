"use client";
export const runtime = 'edge';
import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FileCheck2, Clock, BookOpen, User, Hash } from "lucide-react";
import toast from "react-hot-toast";

interface ExamInfo { id: string; title: string; subject: string; time_limit: number; description: string }
interface Classroom { id: string; name: string; grade: string }

function StudentRegisterContent({ examId }: { examId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classroomId = searchParams.get("cls");

  const [exam, setExam] = useState<ExamInfo | null>(null);
  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [selectedClassroomId, setSelectedClassroomId] = useState<string>(classroomId ?? "");
  const [form, setForm] = useState({ name: "", surname: "", number: "" });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const selectedClassroom = classrooms.find((c) => c.id === selectedClassroomId);

  useEffect(() => {
    const load = async () => {
      const [eRes, cRes] = await Promise.all([
        fetch(`/api/exam-info?id=${examId}`),
        fetch(`/api/classrooms?exam_id=${examId}`),
      ]);

      if (!eRes.ok) { setLoading(false); return; }
      setExam(await eRes.json());

      if (cRes.ok) {
        const clsList: Classroom[] = await cRes.json();
        setClassrooms(clsList);
        if (classroomId && clsList.some((c) => c.id === classroomId)) {
          setSelectedClassroomId(classroomId);
        } else if (clsList.length === 1) {
          setSelectedClassroomId(clsList[0].id);
        }
      }
      setLoading(false);
    };
    load();
  }, [examId, classroomId]);

  const start = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("กรุณากรอกชื่อ");
    if (!form.surname.trim()) return toast.error("กรุณากรอกนามสกุล");
    if (!form.number.trim()) return toast.error("กรุณากรอกเลขที่");
    if (!selectedClassroomId) return toast.error("กรุณาเลือกห้องเรียน");

    setSubmitting(true);
    const fullName = `${form.name.trim()} ${form.surname.trim()}`;
    sessionStorage.setItem("student_info", JSON.stringify({ name: fullName, number: form.number, classroom_id: selectedClassroomId }));
    router.push(`/exam/${examId}/take`);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-white">
          <FileCheck2 className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <p>กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  if (!exam) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass rounded-3xl p-10 text-center">
          <p className="text-2xl mb-2">❌</p>
          <p className="text-slate-700 font-semibold">ไม่พบข้อสอบ หรือปิดการสอบแล้ว</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-3xl shadow-2xl p-8 w-full max-w-md animate-fade-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-teal-400 rounded-2xl flex items-center justify-center shadow-lg mx-auto mb-4">
            <FileCheck2 className="w-10 h-10 text-white" />
          </div>
          <p className="text-xs font-bold text-blue-600 mb-1 tracking-wide">โรงเรียนบ้านครัว(ซิเมนต์ไทยสงเคราะห์)</p>
          <h1 className="text-2xl font-bold text-slate-800">{exam.title}</h1>
          {exam.description && <p className="text-slate-500 text-sm mt-1">{exam.description}</p>}

          <div className="flex justify-center gap-4 mt-4">
            <div className="flex items-center gap-1 text-sm text-slate-500">
              <Clock className="w-4 h-4 text-blue-500" />
              <span>{exam.time_limit} นาที</span>
            </div>
            {selectedClassroom && (
              <div className="flex items-center gap-1 text-sm text-slate-500">
                <BookOpen className="w-4 h-4 text-green-500" />
                <span>{selectedClassroom.grade} {selectedClassroom.name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Form */}
        <form onSubmit={start} className="space-y-4">
          {classrooms.length > 1 && !classroomId && (
            <div>
              <label className="label">ห้องเรียน</label>
              <div className="relative">
                <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <select
                  className="input-field pl-10"
                  value={selectedClassroomId}
                  onChange={(e) => setSelectedClassroomId(e.target.value)}
                  required
                >
                  <option value="">-- เลือกห้องเรียน --</option>
                  {classrooms.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.grade} {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <div>
            <label className="label">ชื่อ</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input-field pl-10" placeholder="ชื่อ" value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">นามสกุล</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input-field pl-10" placeholder="นามสกุล" value={form.surname}
                onChange={(e) => setForm((p) => ({ ...p, surname: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="label">เลขที่</label>
            <div className="relative">
              <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input className="input-field pl-10" placeholder="เลขที่ในห้อง" type="number" min="1"
                value={form.number} onChange={(e) => setForm((p) => ({ ...p, number: e.target.value }))} />
            </div>
          </div>

          <button type="submit" disabled={submitting}
            className="btn-primary w-full mt-6 text-lg py-4">
            {submitting ? "กำลังเข้าสู่การสอบ..." : "🚀 เริ่มสอบเลย!"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ExamStartPage({ params }: { params: { id: string } }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-blue-800 to-teal-700">
      <Suspense>
        <StudentRegisterContent examId={params.id} />
      </Suspense>
    </div>
  );
}
