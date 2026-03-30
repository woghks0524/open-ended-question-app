"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface FeedbackItem {
  feedback: string;
  score: number | null;
}

interface Props {
  settingName: string;
  grade: string;
  studentClass: string;
  studentNumber: string;
  studentName: string;
  questions: string[];
  answers: string[];
  feedbacks: FeedbackItem[];
  sheetUrl: string;
}

export default function Step5Save({
  settingName,
  grade,
  studentClass,
  studentNumber,
  studentName,
  questions,
  answers,
  feedbacks,
  sheetUrl,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 피드백에서 3번째 문단 이후만 추출 (기존 로직 재현)
  const getPartialFeedback = (text: string) => {
    const paragraphs = text.split(/\n{2,}/).filter(Boolean);
    return paragraphs.length >= 3 ? paragraphs.slice(2).join("\n\n") : text;
  };

  const handleSave = async () => {
    setLoading(true);
    setAlert(null);

    try {
      const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });

      const rowData = [
        now,
        settingName,
        grade,
        studentClass,
        studentNumber,
        studentName,
      ];

      for (let i = 0; i < 3; i++) {
        rowData.push(
          questions[i] || "",
          feedbacks[i]?.score?.toString() || "",
          answers[i] || "",
          feedbacks[i]?.feedback ? getPartialFeedback(feedbacks[i].feedback) : ""
        );
      }

      const res = await fetch("/api/results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetUrl, rowData }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setAlert({ type: "success", message: "저장 완료!" });
    } catch (e) {
      setAlert({ type: "error", message: `저장 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">5단계. 결과 저장하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {/* 결과 요약 */}
        <div className="mb-6 space-y-3">
          <div className="text-sm text-gray-600">
            <span className="font-medium">학생:</span> {grade}학년 {studentClass}반 {studentNumber}번 {studentName}
          </div>
          {feedbacks.map((fb, i) => (
            fb.score !== null && (
              <div key={i} className="text-sm text-gray-600">
                <span className="font-medium">{i + 1}번 문항:</span> {fb.score}점
              </div>
            )
          ))}
        </div>

        <button
          onClick={handleSave}
          disabled={loading}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          결과 저장
        </button>

        {loading && <LoadingSpinner message="저장 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
