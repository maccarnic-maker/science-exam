"use client";

import React, { useState } from "react";
import { createPortal } from 'react-dom';
import { X, Printer, Download, BookOpen, Users, CheckCircle2, Award } from "lucide-react";
import Image from "next/image";

interface Classroom {
  id: string;
  name: string;
  grade: string;
}

interface Result {
  id: string;
  student_name: string;
  student_number: string;
  classroom_id?: string;
  classroom_name: string;
  score: number | null;
  total_points: number | null;
  started_at: number;
  submitted_at: number | null;
  last_active_at: number | null;
  tab_switches: number;
  status: string;
}

interface Props {
  examTitle: string;
  subject: string;
  timeLimit: number;
  questionCount: number;
  classrooms: Classroom[];
  results: Result[];
  onClose: () => void;
}

export default function ScoreReportModal({
  examTitle,
  subject,
  timeLimit,
  questionCount,
  classrooms,
  results,
  onClose,
}: Props) {
  const [selectedClassroom, setSelectedClassroom] = useState<string>("all");

  const filteredResults =
    selectedClassroom === "all"
      ? results
      : results.filter(
          (r) =>
            r.classroom_id === selectedClassroom ||
            r.classroom_name === selectedClassroom
        );

  // Statistics
  const totalStudents = filteredResults.length;
  const submittedStudents = filteredResults.filter(
    (r) => r.status === "completed" || r.submitted_at !== null
  );
  const submittedCount = submittedStudents.length;

  const totalPossiblePoints =
    submittedStudents[0]?.total_points ?? (questionCount > 0 ? questionCount : 10);

  const scores = submittedStudents.map((r) => r.score ?? 0);
  const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
  const minScore = scores.length > 0 ? Math.min(...scores) : 0;
  const avgScore =
    scores.length > 0
      ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
      : "0.0";
  const passCount = submittedStudents.filter((r) => {
    const total = r.total_points ?? totalPossiblePoints;
    return total > 0 ? (r.score ?? 0) / total >= 0.5 : false;
  }).length;
  const passPercent =
    submittedCount > 0 ? Math.round((passCount / submittedCount) * 100) : 0;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadCSV = () => {
    if (filteredResults.length === 0) return;

    const headers = [
      "ลำดับ",
      "เลขที่",
      "ชื่อ-นามสกุล",
      "ห้องเรียน",
      "คะแนนที่ได้",
      "คะแนนเต็ม",
      "ร้อยละ (%)",
      "ระดับคุณภาพ",
      "ผลการประเมิน",
      "สลับหน้าจอ (ครั้ง)",
      "เวลาเริ่มสอบ",
      "เวลาส่งข้อสอบ",
    ];

    const rows = filteredResults.map((r, i) => {
      const isSub = r.status === "completed" || r.submitted_at !== null;
      const total = r.total_points ?? totalPossiblePoints;
      const pct = total > 0 ? Math.round(((r.score ?? 0) / total) * 100) : 0;
      const grade =
        pct >= 80 ? "ดีเยี่ยม" : pct >= 70 ? "ดี" : pct >= 60 ? "ปานกลาง" : pct >= 50 ? "พอใช้" : "ควรปรับปรุง";
      const statusText = isSub ? (pct >= 50 ? "ผ่าน" : "ไม่ผ่าน") : "ยังไม่ส่ง";
      const startTime = r.started_at
        ? new Date(r.started_at * 1000).toLocaleString("th-TH")
        : "-";
      const submitTime = r.submitted_at
        ? new Date(r.submitted_at * 1000).toLocaleString("th-TH")
        : "-";

      return [
        i + 1,
        r.student_number,
        `"${r.student_name.replace(/"/g, '""')}"`,
        `"${(r.classroom_name ?? "").replace(/"/g, '""')}"`,
        r.score ?? 0,
        total,
        pct,
        `"${grade}"`,
        `"${statusText}"`,
        r.tab_switches ?? 0,
        `"${startTime}"`,
        `"${submitTime}"`,
      ];
    });

    const csvContent =
      "\uFEFF" + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const roomName =
      selectedClassroom !== "all"
        ? classrooms.find((c) => c.id === selectedClassroom)?.name ?? selectedClassroom
        : "ทั้งหมด";
    link.href = url;
    link.download = `รายงานคะแนน_${examTitle}_ห้อง_${roomName}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const todayThai = new Date().toLocaleDateString("th-TH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return createPortal(
    <div className="score-report-shell fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in print:p-0 print:bg-white">
      <div className="score-report-dialog bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden print:max-h-none print:shadow-none print:rounded-none print:w-full">
        {/* Top Control Bar (Hidden on print) */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-slate-50/80 print:hidden">
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-800 text-base sm:text-lg">
              พิมพ์ / ดาวน์โหลดรายงานคะแนน
            </h2>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {classrooms.length > 1 && (
              <select
                value={selectedClassroom}
                onChange={(e) => setSelectedClassroom(e.target.value)}
                className="text-xs sm:text-sm bg-white border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-700 outline-none"
              >
                <option value="all">ทุกห้องเรียน</option>
                {classrooms.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.grade} {c.name}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors"
            >
              <Printer className="w-4 h-4" /> พิมพ์รายงาน (PDF)
            </button>

            <button
              onClick={handleDownloadCSV}
              className="inline-flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition-colors"
            >
              <Download className="w-4 h-4" /> ดาวน์โหลด Excel (CSV)
            </button>

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Area */}
        <div
          id="printable-report"
          className="p-6 sm:p-10 overflow-y-auto flex-1 text-slate-800 print:overflow-visible print:p-0"
        >
          {/* Official School Header */}
          <div className="text-center pb-6 border-b border-slate-200">
            <div className="relative w-16 h-16 mx-auto mb-2">
              <Image
                src="/school-logo-qr.png"
                alt="School Logo"
                width={64}
                height={64}
                className="object-contain mx-auto"
              />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              โรงเรียนบ้านครัว (ซิเมนต์ไทยสงเคราะห์)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              สำนักงานเขตพื้นที่การศึกษาประถมศึกษาสระบุรี เขต 1
            </p>
            <h2 className="text-base sm:text-lg font-bold text-blue-800 mt-3">
              แบบรายงานผลการทดสอบออนไลน์
            </h2>
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs text-slate-600 mt-1 font-medium">
              <span><strong>แบบทดสอบ:</strong> {examTitle}</span>
              <span>•</span>
              <span><strong>วิชา:</strong> {subject}</span>
              <span>•</span>
              <span><strong>เวลาสอบ:</strong> {timeLimit} นาที</span>
              <span>•</span>
              <span><strong>จำนวนข้อ:</strong> {questionCount} ข้อ</span>
              <span>•</span>
              <span><strong>วันที่ออกรายงาน:</strong> {todayThai}</span>
            </div>
          </div>

          {/* Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-6 text-center text-xs">
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
              <p className="text-slate-500 mb-0.5">ผู้เข้าสอบทั้งหมด</p>
              <p className="text-lg font-bold text-slate-800">
                {submittedCount}/{totalStudents} คน
              </p>
            </div>
            <div className="p-3 bg-blue-50/60 border border-blue-200/60 rounded-xl">
              <p className="text-blue-600 mb-0.5">คะแนนเฉลี่ย</p>
              <p className="text-lg font-bold text-blue-700">
                {avgScore} / {totalPossiblePoints}
              </p>
            </div>
            <div className="p-3 bg-indigo-50/60 border border-indigo-200/60 rounded-xl">
              <p className="text-indigo-600 mb-0.5">สูงสุด - ต่ำสุด</p>
              <p className="text-lg font-bold text-indigo-700">
                {maxScore} - {minScore}
              </p>
            </div>
            <div className="p-3 bg-emerald-50/60 border border-emerald-200/60 rounded-xl">
              <p className="text-emerald-600 mb-0.5">ผ่านเกณฑ์ (≥50%)</p>
              <p className="text-lg font-bold text-emerald-700">
                {passCount} คน ({passPercent}%)
              </p>
            </div>
          </div>

          {/* Students Result Table */}
          {filteredResults.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              ไม่มีข้อมูลผลสอบของห้องเรียนนี้
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-y border-slate-300 font-bold">
                    <th className="py-2.5 px-2 text-center w-10">ที่</th>
                    <th className="py-2.5 px-2 text-center w-12">เลขที่</th>
                    <th className="py-2.5 px-3 text-left">ชื่อ - นามสกุล</th>
                    <th className="py-2.5 px-2 text-center w-24">ห้อง</th>
                    <th className="py-2.5 px-2 text-center w-16">คะแนน</th>
                    <th className="py-2.5 px-2 text-center w-16">ร้อยละ</th>
                    <th className="py-2.5 px-2 text-center w-20">ระดับคุณภาพ</th>
                    <th className="py-2.5 px-2 text-center w-20">ผลประเมิน</th>
                    <th className="py-2.5 px-2 text-center w-20 print:hidden">สลับจอ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredResults.map((r, i) => {
                    const isSub = r.status === "completed" || r.submitted_at !== null;
                    const total = r.total_points ?? totalPossiblePoints;
                    const pct = total > 0 ? Math.round(((r.score ?? 0) / total) * 100) : 0;
                    const grade =
                      pct >= 80 ? "ดีเยี่ยม" : pct >= 70 ? "ดี" : pct >= 60 ? "ปานกลาง" : pct >= 50 ? "พอใช้" : "ควรปรับปรุง";
                    const isPass = pct >= 50;

                    return (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-2 px-2 text-center text-slate-500 font-mono">
                          {i + 1}
                        </td>
                        <td className="py-2 px-2 text-center font-mono font-semibold">
                          {r.student_number}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-800">
                          {r.student_name}
                        </td>
                        <td className="py-2 px-2 text-center text-slate-600">
                          {r.classroom_name}
                        </td>
                        <td className="py-2 px-2 text-center font-bold font-mono text-slate-900">
                          {isSub ? `${r.score ?? 0}/${total}` : "-"}
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-700">
                          {isSub ? `${pct}%` : "-"}
                        </td>
                        <td className="py-2 px-2 text-center font-bold">
                          {isSub ? (
                            <span
                              className={
                                pct >= 70
                                  ? "text-emerald-700"
                                  : pct >= 50
                                  ? "text-blue-700"
                                  : "text-red-600"
                              }
                            >
                              {grade}
                            </span>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="py-2 px-2 text-center font-semibold">
                          {isSub ? (
                            isPass ? (
                              <span className="text-emerald-700">ผ่าน</span>
                            ) : (
                              <span className="text-red-600">ไม่ผ่าน</span>
                            )
                          ) : (
                            <span className="text-slate-400">ยังไม่ส่ง</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-center print:hidden">
                          {r.tab_switches > 0 ? (
                            <span className="text-red-600 font-semibold font-mono">
                              {r.tab_switches} ครั้ง
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">0</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Teacher Signature Sign-off */}
          <div className="mt-12 pt-8 grid grid-cols-2 gap-8 text-center text-xs border-t border-slate-200">
            <div>
              <p className="mb-10 text-slate-500">ลงชื่อ ................................................................ ครูผู้สอน</p>
              <p className="font-semibold text-slate-700">( ................................................................ )</p>
              <p className="text-slate-400 mt-1">ตำแหน่ง ครูผู้สอน</p>
            </div>
            <div>
              <p className="mb-10 text-slate-500">ลงชื่อ ................................................................ ผู้ตรวจ/รับรอง</p>
              <p className="font-semibold text-slate-700">( ................................................................ )</p>
              <p className="text-slate-400 mt-1">หัวหน้ากลุ่มสาระฯ / ฝ่ายวิชาการ</p>
            </div>
          </div>
        </div>
      </div>
    </div>, document.body
  );
}
