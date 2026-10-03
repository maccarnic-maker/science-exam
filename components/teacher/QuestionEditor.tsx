"use client";
import { useState } from "react";
import { PlusCircle, Trash2, GripVertical, CheckCircle } from "lucide-react";
import ImageUpload from "./ImageUpload";
import toast from "react-hot-toast";

interface Choice {
  id?: string;
  text: string;
  image?: string | null;
  is_correct: boolean;
  order_num: number;
}

interface Question {
  id?: string;
  question_text: string;
  question_image?: string | null;
  question_type: string;
  points: number;
  order_num: number;
  choices: Choice[];
}

interface Props {
  examId: string;
  question?: Question;
  onSaved: () => void;
  onCancel: () => void;
}

const defaultChoices = (): Choice[] =>
  ["ก", "ข", "ค", "ง"].map((label, i) => ({
    text: `ตัวเลือก ${label}`,
    image: null,
    is_correct: i === 0,
    order_num: i + 1,
  }));

export default function QuestionEditor({ examId, question, onSaved, onCancel }: Props) {
  const [q, setQ] = useState<Question>(
    question ?? {
      question_text: "",
      question_image: null,
      question_type: "multiple_choice",
      points: 1,
      order_num: 1,
      choices: defaultChoices(),
    }
  );
  const [saving, setSaving] = useState(false);

  const setCorrect = (i: number) =>
    setQ((p) => ({ ...p, choices: p.choices.map((c, idx) => ({ ...c, is_correct: idx === i })) }));

  const updateChoice = (i: number, field: keyof Choice, value: string | boolean | null) =>
    setQ((p) => ({ ...p, choices: p.choices.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }));

  const addChoice = () =>
    setQ((p) => ({
      ...p,
      choices: [...p.choices, { text: `ตัวเลือก ${p.choices.length + 1}`, image: null, is_correct: false, order_num: p.choices.length + 1 }],
    }));

  const removeChoice = (i: number) =>
    setQ((p) => ({ ...p, choices: p.choices.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!q.question_text.trim()) return toast.error("กรุณาใส่โจทย์ข้อสอบ");
    if (!q.choices.some((c) => c.is_correct)) return toast.error("กรุณาเลือกคำตอบที่ถูกต้อง");

    setSaving(true);
    const method = q.id ? "PUT" : "POST";
    const body = q.id
      ? { ...q, choices: q.choices.map((c, i) => ({ ...c, order_num: i + 1 })) }
      : { exam_id: examId, ...q, choices: q.choices.map((c, i) => ({ ...c, order_num: i + 1 })) };

    const res = await fetch("/api/questions", {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (res.ok) {
      toast.success(q.id ? "อัปเดตข้อสอบแล้ว" : "เพิ่มข้อสอบแล้ว");
      onSaved();
    } else {
      toast.error("บันทึกไม่สำเร็จ");
    }
  };

  const LABELS = ["ก", "ข", "ค", "ง", "จ", "ฉ"];

  return (
    <div className="card border-2 border-blue-100 animate-slide-up">
      {/* Question */}
      <div className="mb-4">
        <label className="label">โจทย์ข้อสอบ</label>
        <div className="flex gap-2 items-start">
          <textarea
            className="input-field flex-1 resize-none"
            rows={3}
            placeholder="พิมพ์โจทย์ข้อสอบที่นี่..."
            value={q.question_text}
            onChange={(e) => setQ((p) => ({ ...p, question_text: e.target.value }))}
          />
          <div className="pt-1">
            <ImageUpload
              value={q.question_image}
              onChange={(url) => setQ((p) => ({ ...p, question_image: url }))}
              label="เพิ่มรูปโจทย์"
            />
          </div>
        </div>
        {q.question_image && (
          <p className="text-xs text-green-600 mt-1">✅ มีรูปภาพประกอบโจทย์</p>
        )}
      </div>

      <div className="mb-4">
        <label className="label">คะแนน</label>
        <input type="number" min={1} max={100} className="input-field w-24" value={q.points === 0 ? "" : q.points}
          onChange={(e) => {
            const val = e.target.value;
            setQ((p) => ({ ...p, points: val === "" ? 0 : parseInt(val, 10) || 0 }));
          }} placeholder="1" />
      </div>

      {/* Choices */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">ตัวเลือกคำตอบ <span className="text-blue-500">(คลิก ✓ เพื่อเลือกคำตอบที่ถูก)</span></label>
          <button type="button" onClick={addChoice}
            className="flex items-center gap-1 text-blue-600 text-sm hover:underline">
            <PlusCircle className="w-4 h-4" /> เพิ่มตัวเลือก
          </button>
        </div>

        <div className="space-y-2">
          {q.choices.map((choice, i) => (
            <div key={i} className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-colors
              ${choice.is_correct ? "border-green-300 bg-green-50" : "border-slate-200 bg-white"}`}>
              <GripVertical className="w-4 h-4 text-slate-300 flex-shrink-0" />

              {/* Correct button */}
              <button type="button" onClick={() => setCorrect(i)}
                className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm transition-all
                  ${choice.is_correct ? "bg-green-500 text-white shadow-md" : "bg-slate-200 text-slate-500 hover:bg-slate-300"}`}>
                {choice.is_correct ? <CheckCircle className="w-4 h-4" /> : LABELS[i] ?? i + 1}
              </button>

              {/* Choice text */}
              <input
                className={`flex-1 bg-transparent outline-none text-sm font-medium
                  ${choice.is_correct ? "text-green-800" : "text-slate-700"}`}
                value={choice.text}
                onChange={(e) => updateChoice(i, "text", e.target.value)}
                placeholder={`ตัวเลือก ${LABELS[i] ?? i + 1}`}
              />

              {/* Image for choice */}
              <ImageUpload
                value={choice.image}
                onChange={(url) => updateChoice(i, "image", url)}
                label="เพิ่มรูปตัวเลือก"
                size="sm"
              />

              {/* Delete */}
              {q.choices.length > 2 && (
                <button type="button" onClick={() => removeChoice(i)}
                  className="text-red-400 hover:text-red-600">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="btn-secondary flex-1 py-2">
          ยกเลิก
        </button>
        <button type="button" onClick={save} disabled={saving} className="btn-primary flex-1 py-2">
          {saving ? "กำลังบันทึก..." : q.id ? "💾 อัปเดต" : "✅ บันทึกข้อสอบ"}
        </button>
      </div>
    </div>
  );
}
