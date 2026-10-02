"use client";
import { useEffect, useState } from "react";
import { X, Copy, Download, QrCode, ExternalLink } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";

interface Classroom { id: string; name: string; grade: string }

interface Props {
  examId: string;
  examTitle: string;
  classrooms: Classroom[];
  onClose: () => void;
}

export default function QRModal({ examId, examTitle, classrooms, onClose }: Props) {
  const [selected, setSelected] = useState<Classroom | null>(classrooms[0] ?? null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const examUrl = selected
    ? `${baseUrl}/exam/${examId}?cls=${selected.id}`
    : "";

  const copy = () => {
    navigator.clipboard.writeText(examUrl);
    toast.success("คัดลอกลิงค์แล้ว!");
  };

  const downloadQR = () => {
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 400; canvas.height = 400;
    const ctx = canvas.getContext("2d")!;
    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 400, 400);
      ctx.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement("a");
      link.download = `qr-${selected?.name ?? "exam"}.png`;
      link.href = canvas.toDataURL();
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(svgData)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <QrCode className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">QR Code / ลิงค์เข้าสอบ</h2>
              <p className="text-xs text-slate-400">{examTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Classroom selector */}
        <div className="px-6 pt-5">
          <label className="label">เลือกห้องเรียน</label>
          <div className="flex flex-wrap gap-2">
            {classrooms.map((cls) => (
              <button key={cls.id} type="button"
                onClick={() => setSelected(cls)}
                className={`px-4 py-2 rounded-xl font-semibold text-sm border-2 transition-all
                  ${selected?.id === cls.id
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-600 hover:border-indigo-300"}`}>
                {cls.grade} {cls.name}
              </button>
            ))}
          </div>
        </div>

        {/* QR Code */}
        {selected && (
          <div className="px-6 py-5 flex flex-col items-center">
            <div className="bg-white p-4 rounded-2xl shadow-inner border border-slate-200 mb-4">
              <QRCodeSVG
                id="qr-svg"
                value={examUrl}
                size={200}
                level="H"
                includeMargin
                imageSettings={{
                  src: "/favicon.ico",
                  width: 32,
                  height: 32,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-sm font-semibold text-slate-600 mb-1">
              ห้อง {selected.grade} {selected.name}
            </p>
            <p className="text-xs text-slate-400 mb-4 text-center break-all">{examUrl}</p>

            {/* Actions */}
            <div className="flex gap-3 w-full">
              <button onClick={copy}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors text-sm">
                <Copy className="w-4 h-4" /> คัดลอกลิงค์
              </button>
              <button onClick={downloadQR}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors text-sm">
                <Download className="w-4 h-4" /> ดาวน์โหลด QR
              </button>
              <a href={examUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-700 px-3 py-3 rounded-xl transition-colors">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
