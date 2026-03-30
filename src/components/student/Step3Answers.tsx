"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";

interface Props {
  questions: string[];
  images: string[];
  answers: string[];
  onSave: (answers: string[]) => void;
}

export default function Step3Answers({ questions, images, answers, onSave }: Props) {
  const [localAnswers, setLocalAnswers] = useState(answers);
  const [activeTab, setActiveTab] = useState(0);
  const [alert, setAlert] = useState<{ type: "success"; message: string } | null>(null);

  const updateAnswer = (idx: number, val: string) => {
    const next = [...localAnswers];
    next[idx] = val;
    setLocalAnswers(next);
  };

  const handleSave = (idx: number) => {
    onSave(localAnswers);
    setAlert({ type: "success", message: `${idx + 1}번 답안이 저장되었습니다.` });
  };

  // 문항이 입력된 것만 필터링
  const activeQuestions = questions.map((q, i) => ({ q, i })).filter(({ q }) => q);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">3단계. 답안 작성하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* 탭 */}
        <div className="flex border-b border-gray-200 mb-4">
          {activeQuestions.map(({ i }) => (
            <button
              key={i}
              onClick={() => { setActiveTab(i); setAlert(null); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === i
                  ? "border-green-500 text-green-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {i + 1}번 문항
            </button>
          ))}
        </div>

        {/* 문항 내용 */}
        {activeQuestions.map(({ q, i }) => (
          <div key={i} className={activeTab === i ? "block" : "hidden"}>
            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-800 whitespace-pre-wrap">{q}</p>
              {images[i] && (
                <img
                  src={images[i]}
                  alt={`${i + 1}번 문항 이미지`}
                  className="mt-3 max-w-[300px] rounded border"
                />
              )}
            </div>
            <textarea
              value={localAnswers[i]}
              onChange={(e) => updateAnswer(i, e.target.value)}
              rows={5}
              className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
              placeholder={`${i + 1}번 문항 답안을 작성하세요...`}
            />
            <button
              onClick={() => handleSave(i)}
              className="mt-3 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
            >
              {i + 1}번 답안 저장
            </button>
          </div>
        ))}

        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
