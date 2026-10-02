"use client";
import { useRef, useState } from "react";
import { Camera, X, Loader2 } from "lucide-react";
import Image from "next/image";

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
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/upload", { method: "POST", body: fd });
    setUploading(false);

    if (res.ok) {
      const data = await res.json();
      onChange(data.url);
    }
    e.target.value = "";
  };

  const btnClass = size === "sm"
    ? "w-8 h-8 text-xs rounded-lg"
    : "w-10 h-10 text-sm rounded-xl";

  if (value) {
    return (
      <div className="relative inline-block group">
        <div className={`relative overflow-hidden rounded-xl border-2 border-slate-200 ${size === "sm" ? "w-24 h-20" : "w-40 h-32"}`}>
          <Image src={value} alt="รูปภาพ" fill className="object-cover" />
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
