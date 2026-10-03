"use client";

import React from "react";
import { AlertCircle, AlertTriangle, CheckCircle2, Info, Trash2, X } from "lucide-react";

export interface ModalConfig {
  isOpen: boolean;
  title: string;
  message: string;
  variant?: "danger" | "warning" | "success" | "info";
  confirmText?: string;
  cancelText?: string;
  isAlert?: boolean;
  onConfirm?: () => void;
  onClose?: () => void;
}

export default function CustomModal({
  isOpen,
  title,
  message,
  variant = "info",
  confirmText = "ตกลง",
  cancelText = "ยกเลิก",
  isAlert = false,
  onConfirm,
  onClose,
}: ModalConfig) {
  if (!isOpen) return null;

  const handleClose = () => {
    if (onClose) onClose();
  };

  const handleConfirm = () => {
    if (onConfirm) onConfirm();
    if (onClose) onClose();
  };

  const icons = {
    danger: <Trash2 className="w-8 h-8 text-red-600" />,
    warning: <AlertTriangle className="w-8 h-8 text-amber-500" />,
    success: <CheckCircle2 className="w-8 h-8 text-green-600" />,
    info: <Info className="w-8 h-8 text-blue-600" />,
  };

  const iconBgs = {
    danger: "bg-red-50 border-red-100",
    warning: "bg-amber-50 border-amber-100",
    success: "bg-green-50 border-green-100",
    info: "bg-blue-50 border-blue-100",
  };

  const confirmBtnStyles = {
    danger: "bg-red-600 hover:bg-red-700 text-white shadow-red-200",
    warning: "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-200",
    success: "bg-green-600 hover:bg-green-700 text-white shadow-green-200",
    info: "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full shadow-2xl border border-slate-100 text-center animate-slide-up relative">
        {/* Close icon top-right */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon */}
        <div
          className={`w-16 h-16 rounded-2xl mx-auto flex items-center justify-center border mb-4 shadow-sm ${iconBgs[variant]}`}
        >
          {icons[variant]}
        </div>

        {/* Title */}
        <h3 className="text-xl font-bold text-slate-800 mb-2">{title}</h3>

        {/* Message */}
        <p className="text-sm text-slate-600 whitespace-pre-line leading-relaxed mb-6">
          {message}
        </p>

        {/* Buttons */}
        {isAlert ? (
          <button
            type="button"
            onClick={handleConfirm}
            className={`w-full py-3 px-4 rounded-xl font-semibold shadow-md transition-all ${confirmBtnStyles[variant]}`}
          >
            {confirmText}
          </button>
        ) : (
          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-100/80 transition-colors text-sm"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              className={`flex-1 py-3 px-4 rounded-xl font-semibold shadow-md transition-all text-sm ${confirmBtnStyles[variant]}`}
            >
              {confirmText}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
