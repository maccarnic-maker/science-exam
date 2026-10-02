"use client";
export const runtime = 'edge';
import { useState } from "react";
import { useRouter } from "next/navigation";
import { PlusCircle, Trash2, BookOpen } from "lucide-react";
import toast from "react-hot-toast";

interface Classroom { name: string; grade: string }

export default function NewExamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    subject: "วิทยาศาสตร์",
    time_limit: 60,
  });
  const [classrooms, setClassrooms] = useState<Classroom[]>([{ name: "ห้อง 1", grade: "ป.6" }]);

  const grades = ["อ.1","อ.2","อ.3","ป.1","ป.2","ป.3","ป.4","ป.5","ป.6","ม.1","ม.2","ม.3","ม.4","ม.5","ม.6"];

  const addClassroom = () => setClassrooms((p) => [...p, { name: "ห้อง 1", grade: "ป.6" }]);
  const removeClassroom = (i: number) => setClassrooms((p) => p.filter((_, idx) => idx !== i));
  const updateClassroom = (i: number, field: keyof Classroom, value: string) =>
    setClassrooms((p) => p.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return toast.error("กรุณาใส่ชื่อข้อสอบ");
    if (!classrooms.length) return toast.error("กรุณาเพิ่มห้องเรียนอย่างน้อย 1 ห้อง");

    setLoading(true);
    const res = await fetch("/api/exams", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, classrooms }),
    });
    setLoading(false);

    if (res.ok) {
      const data = (await res.json()) as any;
      toast.success("สร้างชุดข้อสอบสำเร็จ!");
      router.push(`/teacher/exams/${data.id}`);
    } else {
      const err = (await res.json()) as any;
      toast.error(err.error ?? "เกิดข้อผิดพลาด");
    }
  };

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-800">สร้างชุดข้อสอบใหม่ ✨</h1>
        <p className="text-slate-500 mt-1">กรอกข้อมูลชุดข้อสอบและห้องเรียน</p>
      </div>

      <form onSubmit={submit} className="space-y-6">
        {/* Exam Info */}
        <div className="card space-y-4">
          <h2 className="font-bold text-slate-700 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" /> ข้อมูลชุดข้อสอบ
          </h2>

          <div>
            <label className="label">ชื่อชุดข้อสอบ *</label>
            <input className="input-field" placeholder="เช่น สอบกลางภาค วิทย์ ป.6" value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>
          <div>
            <label className="label">คำอธิบาย (ไม่บังคับ)</label>
            <textarea className="input-field resize-none" rows={2} placeholder="รายละเอียดเพิ่มเติม"
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">วิชา</label>
              <input className="input-field" value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))} />
            </div>
            <div>
              <label className="label">เวลาสอบ (นาที)</label>
              <input type="number" min={5} max={300} className="input-field" value={form.time_limit}
                onChange={(e) => setForm((p) => ({ ...p, time_limit: +e.target.value }))} />
            </div>
          </div>
        </div>

        {/* Classrooms */}
        <div className="card space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-slate-700">ห้องเรียนที่จะสอบ</h2>
            <button type="button" onClick={addClassroom}
              className="flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-semibold">
              <PlusCircle className="w-4 h-4" /> เพิ่มห้อง
            </button>
          </div>

          {classrooms.map((cls, i) => (
            <div key={i} className="flex items-center gap-3 bg-slate-50 rounded-xl p-3">
              <div className="flex-1 grid grid-cols-2 gap-3">
                <div>
                  <label className="label text-xs">ชั้น</label>
                  <select className="input-field py-2 text-sm" value={cls.grade}
                    onChange={(e) => updateClassroom(i, "grade", e.target.value)}>
                    {grades.map((g) => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label text-xs">ห้อง</label>
                  <input className="input-field py-2 text-sm" placeholder="เช่น ห้อง 1" value={cls.name}
                    onChange={(e) => updateClassroom(i, "name", e.target.value)} />
                </div>
              </div>
              {classrooms.length > 1 && (
                <button type="button" onClick={() => removeClassroom(i)}
                  className="text-red-400 hover:text-red-600 mt-4">
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Submit */}
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="btn-secondary flex-1">
            ยกเลิก
          </button>
          <button type="submit" disabled={loading} className="btn-primary flex-1">
            {loading ? "กำลังสร้าง..." : "✅ สร้างชุดข้อสอบ"}
          </button>
        </div>
      </form>
    </div>
  );
}
