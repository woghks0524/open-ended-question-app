"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface FeedbackItem {
  feedback: string;
  score: number | null;
}

interface Props {
  questions: string[];
  answers: string[];
  feedbackInstruction: string;
  vectorStoreId: string;
  feedbacks: FeedbackItem[];
  onFeedbacksReceived: (feedbacks: FeedbackItem[]) => void;
}

export default function Step4Feedback({
  questions,
  answers,
  feedbackInstruction,
  vectorStoreId,
  feedbacks,
  onFeedbacksReceived,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const [alert, setAlert] = useState<{ type: "error"; message: string } | null>(null);

  const handleGrade = async () => {
    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          answers,
          feedbackInstruction,
          vectorStoreId,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      onFeedbacksReceived(data.feedbacks);
    } catch (e) {
      setAlert({ type: "error", message: `채점 중 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  const activeQuestions = questions.map((q, i) => ({ q, i })).filter(({ q }) => q);

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">4단계. 채점 결과 및 피드백 확인하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <button
          onClick={handleGrade}
          disabled={loading || feedbacks.length > 0}
          className="px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm mb-4"
        >
          채점 결과 및 피드백 확인
        </button>

        {loading && <LoadingSpinner message="AI가 채점하고 피드백을 생성하고 있습니다... (시간이 걸릴 수 있습니다)" />}

        {feedbacks.length > 0 && (
          <>
            {/* 탭 */}
            <div className="flex border-b border-gray-200 mb-4">
              {activeQuestions.map(({ i }) => (
                <button
                  key={i}
                  onClick={() => setActiveTab(i)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === i
                      ? "border-green-500 text-green-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {i + 1}번 피드백
                  {feedbacks[i]?.score !== null && (
                    <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                      {feedbacks[i].score}점
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* 피드백 내용 */}
            {activeQuestions.map(({ i }) => (
              <div key={i} className={activeTab === i ? "block" : "hidden"}>
                <div className="p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap leading-relaxed">
                  {feedbacks[i]?.feedback || "피드백 없음"}
                </div>
              </div>
            ))}
          </>
        )}

        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
