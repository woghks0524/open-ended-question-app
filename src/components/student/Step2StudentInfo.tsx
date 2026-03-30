"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";

interface StudentInfo {
  grade: string;
  studentClass: string;
  studentNumber: string;
  studentName: string;
}

interface Props {
  info: StudentInfo;
  onSave: (info: StudentInfo) => void;
}

export default function Step2StudentInfo({ info, onSave }: Props) {
  const [grade, setGrade] = useState(info.grade);
  const [studentClass, setStudentClass] = useState(info.studentClass);
  const [studentNumber, setStudentNumber] = useState(info.studentNumber);
  const [studentName, setStudentName] = useState(info.studentName);
  const [alert, setAlert] = useState<{ type: "success" | "warning"; message: string } | null>(null);

  const handleSave = () => {
    if (!/^\d+$/.test(grade)) {
      setAlert({ type: "warning", message: "학년은 숫자로 입력해야 합니다." });
      return;
    }
    if (!/^\d+$/.test(studentClass)) {
      setAlert({ type: "warning", message: "반은 숫자로 입력해야 합니다." });
      return;
    }
    if (!/^\d+$/.test(studentNumber)) {
      setAlert({ type: "warning", message: "번호는 숫자로 입력해야 합니다." });
      return;
    }
    if (!studentName.trim()) {
      setAlert({ type: "warning", message: "이름을 입력하세요." });
      return;
    }

    onSave({ grade, studentClass, studentNumber, studentName });
    setAlert({ type: "success", message: "학생 정보가 저장되었습니다." });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">2단계. 학생 기본정보 입력하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
            <input
              type="text"
              value={grade}
              onChange={(e) => setGrade(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">반</label>
            <input
              type="text"
              value={studentClass}
              onChange={(e) => setStudentClass(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">번호</label>
            <input
              type="text"
              value={studentNumber}
              onChange={(e) => setStudentNumber(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이름</label>
            <input
              type="text"
              value={studentName}
              onChange={(e) => setStudentName(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>
        <button
          onClick={handleSave}
          className="mt-4 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
        >
          저장
        </button>
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
