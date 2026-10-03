"use client";
import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import { compressImage } from "@/lib/image-compressor";

interface Props {
  value?: string | null;
  onChange: (url: string | null) => void;
  label?: string;
  size?: "sm" | "md";
}

export default function ImageUpload({ value, onChange, label = "เพิ่มรูปภาพ", size = "md" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile) return;

    setUploading(true);

    try {
      // ลดขนาดรูปภาพลงอัตโนมัติก่อนอัปโหลดเข้า Cloudflare R2
      const compressedFile = await compressImage(rawFile, 1280, 1280, 0.8);

      const fd = new FormData();
      fd.append("file", compressedFile);

      const res = await fetch("/api/upload", { method: "POST", body: fd });
      if (res.ok) {
        const data = (await res.json()) as any;
        onChange(data.url);
      }
    } catch {
      // fallback
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const btnClass = size === "sm"
    ? "w-8 h-8 text-xs rounded-lg"
    : "w-10 h-10 text-sm rounded-xl";

  if (value) {
    return (
      <div className="relative inline-block group">
        <div className={`relative overflow-hidden rounded-xl border-2 border-slate-200 bg-slate-50 flex items-center justify-center ${size === "sm" ? "w-24 h-20" : "w-40 h-32"}`}>
          <img src={value} alt="รูปภาพ" className="w-full h-full object-cover" />
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-md hover:bg-red-600 transition-colors"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <>
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        title={label}
        className={`${btnClass} bg-slate-100 hover:bg-blue-50 hover:border-blue-300 border-2 border-dashed border-slate-300
          flex items-center justify-center text-slate-400 hover:text-blue-500 transition-all duration-200 cursor-pointer`}
      >
        {uploading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Camera className="w-4 h-4" />
        )}
      </button>
    </>
  );
}
