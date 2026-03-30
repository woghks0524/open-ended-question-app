"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";

interface Props {
  feedbackInstruction: string;
  onSave: (instruction: string) => void;
}

export default function Step5Instructions({ feedbackInstruction, onSave }: Props) {
  const [note, setNote] = useState(feedbackInstruction);
  const [alert, setAlert] = useState<{ type: "success"; message: string } | null>(null);

  const handleSave = () => {
    onSave(note);
    setAlert({ type: "success", message: "평가 주의 사항이 저장되었습니다." });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">5단계. 평가 주의 사항 입력하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-sm text-gray-600 mb-3">
          피드백 내용, 길이, 수준, 말투, 언어, 채점 결과 단계(3단계, 5단계 등), 문단 구성 등을 자유롭게 입력하세요.
        </p>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          placeholder="평가 주의 사항을 입력하세요..."
        />
        <button
          onClick={handleSave}
          className="mt-4 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          평가 주의 사항 저장
        </button>
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
