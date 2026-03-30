"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";

const GRADES = ["4학년 1학기", "4학년 2학기", "5학년 1학기", "5학년 2학기"];
const SUBJECTS = ["과학", "사회"];
const PUBLISHERS = ["천재교과서/천재교육", "비상교과서", "아이스크림미디어"];

interface Props {
  grade: string;
  subject: string;
  publisher: string;
  onSave: (grade: string, subject: string, publisher: string) => void;
}

export default function Step2BasicInfo({ grade, subject, publisher, onSave }: Props) {
  const [g, setG] = useState(grade || GRADES[0]);
  const [s, setS] = useState(subject || SUBJECTS[0]);
  const [p, setP] = useState(publisher || PUBLISHERS[0]);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSave = () => {
    onSave(g, s, p);
    setAlert({ type: "success", message: "선택이 저장되었습니다." });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">2단계. 평가 기본정보 선택하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학년 / 학기</label>
          <select
            value={g}
            onChange={(e) => setG(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {GRADES.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
          <select
            value={s}
            onChange={(e) => setS(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {SUBJECTS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출판사</label>
          <select
            value={p}
            onChange={(e) => setP(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {PUBLISHERS.map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </select>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          선택 저장
        </button>

        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
