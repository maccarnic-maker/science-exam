"use client";
import { useState } from "react";
import { X, Copy, Download, QrCode, ExternalLink, KeyRound } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import toast from "react-hot-toast";
import { SCHOOL_LOGO_BASE64 } from "@/lib/school-logo";

interface Classroom { id: string; name: string; grade: string }

interface Props {
  examId: string;
  examTitle: string;
  examToken?: string;
  classrooms: Classroom[];
  onClose: () => void;
}

export default function QRModal({ examId, examTitle, examToken, classrooms, onClose }: Props) {
  const [selected, setSelected] = useState<Classroom | null>(classrooms[0] ?? null);
  const baseUrl = typeof window !== "undefined" ? window.location.origin : "";

  const shortCode = examToken || examId;
  const shortUrl = selected
    ? `${baseUrl}/s/${shortCode}?cls=${selected.id}`
    : `${baseUrl}/s/${shortCode}`;

  const cleanShortUrl = `${baseUrl}/s/${shortCode}`;

  const copyShortUrl = () => {
    navigator.clipboard.writeText(shortUrl);
    toast.success("คัดลอกลิงก์เรียบร้อยแล้ว!");
  };

  const copyPin = () => {
    if (!examToken) return;
    navigator.clipboard.writeText(examToken);
    toast.success(`คัดลอกรหัส PIN: ${examToken} เรียบร้อยแล้ว!`);
  };

  const downloadQR = () => {
    const svg = document.getElementById("qr-svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 800;
    const ctx = canvas.getContext("2d")!;
    const img = new window.Image();
    img.onload = () => {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 800, 800);
      ctx.drawImage(img, 0, 0, 800, 800);
      const link = document.createElement("a");
      link.download = `qr-${selected?.name ?? "exam"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg animate-slide-up max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center">
              <QrCode className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800">QR Code / รหัสเข้าสอบ</h2>
              <p className="text-xs text-slate-400">{examTitle}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* PIN banner */}
        {examToken && (
          <div className="mx-6 mt-4 p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200/80 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-sm">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium">รหัสข้อสอบ (PIN 6 หลัก พิมพ์ง่าย)</p>
                <p className="text-xl font-black font-mono tracking-wider text-blue-700">{examToken}</p>
              </div>
            </div>
            <button
              onClick={copyPin}
              className="text-xs font-semibold px-3 py-1.5 bg-white border border-blue-200 rounded-xl text-blue-700 hover:bg-blue-50 shadow-sm transition-all"
            >
              คัดลอก PIN
            </button>
          </div>
        )}

        {/* Classroom selector */}
        <div className="px-6 pt-4">
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
          <div className="px-6 py-4 flex flex-col items-center">
            <div className="bg-white p-3.5 rounded-2xl shadow-inner border border-slate-200 mb-3">
              <QRCodeSVG
                id="qr-svg"
                value={shortUrl}
                size={210}
                level="H"
                includeMargin
                imageSettings={{
                  src: SCHOOL_LOGO_BASE64,
                  width: 46,
                  height: 46,
                  excavate: true,
                }}
              />
            </div>
            <p className="text-sm font-semibold text-slate-700 mb-0.5">
              ห้อง {selected.grade} {selected.name}
            </p>
            <div className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-1.5 mb-4 text-center max-w-full">
              <p className="text-xs text-slate-500 font-mono break-all font-semibold select-all">
                {shortUrl}
              </p>
            </div>

            {/* Actions */}
            <div className="flex gap-2.5 w-full">
              <button onClick={copyShortUrl}
                className="flex-1 flex items-center justify-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-2.5 rounded-xl transition-colors text-xs sm:text-sm">
                <Copy className="w-4 h-4" /> คัดลอกลิงก์
              </button>
              <button onClick={downloadQR}
                className="flex-1 flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 rounded-xl transition-colors text-xs sm:text-sm">
                <Download className="w-4 h-4" /> ดาวน์โหลด QR
              </button>
              <a href={shortUrl} target="_blank" rel="noreferrer"
                className="flex items-center justify-center bg-green-50 hover:bg-green-100 text-green-700 px-3 py-2.5 rounded-xl transition-colors"
                title="เปิดลิงก์เข้าสอบ">
                <ExternalLink className="w-4 h-4" />
              </a>
            </div>

            <p className="text-[11px] text-slate-400 mt-3 text-center">
              💡 นักเรียนสามารถสแกน QR Code หรือเปิดเว็บแล้วกรอกรหัส PIN: <strong>{examToken}</strong> ได้เลย
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
