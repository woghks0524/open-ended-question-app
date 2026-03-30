"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  settingName: string;
  onSettingNameChange: (name: string) => void;
}

export default function Step1Code({ settingName, onSettingNameChange }: Props) {
  const [input, setInput] = useState(settingName);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleRegister = async () => {
    setAlert(null);
    if (!input || /^\d+$/.test(input)) {
      setAlert({ type: "error", message: "평가 코드에는 문자가 반드시 포함되어야 합니다. 숫자로만 이루어진 평가 코드는 사용할 수 없습니다." });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/assessment/check-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: input }),
      });
      const data = await res.json();

      if (!res.ok) {
        setAlert({ type: "error", message: data.error });
      } else {
        onSettingNameChange(input);
        setAlert({ type: "success", message: `'${input}' 평가 코드가 등록되었습니다.` });
      }
    } catch {
      setAlert({ type: "error", message: "서버 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">1단계. 평가 코드 만들기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          학생들이 평가에 참여할 수 있도록 안내하기 위한 평가 코드를 만들어주세요.
        </label>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="평가 코드 입력"
        />
        <button
          onClick={handleRegister}
          disabled={loading}
          className="mt-4 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
        >
          평가 코드 등록
        </button>
        {loading && <LoadingSpinner message="코드 확인 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
