"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface AssessmentData {
  settingname: string;
  question1: string;
  question2: string;
  question3: string;
  image1: string;
  image2: string;
  image3: string;
  feedbackinstruction: string;
  assiapi2: string;
  vectorapi: string;
  sheeturl: string;
  [key: string]: string;
}

interface Props {
  onLoaded: (data: AssessmentData) => void;
  loaded: boolean;
}

export default function Step1Code({ onLoaded, loaded }: Props) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleLookup = async () => {
    if (!code.trim()) {
      setAlert({ type: "error", message: "평가 코드를 입력하세요." });
      return;
    }

    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch(`/api/assessment?code=${encodeURIComponent(code)}`);
      const data = await res.json();

      if (!res.ok) {
        setAlert({ type: "error", message: data.error });
      } else {
        onLoaded(data);
        setAlert({ type: "success", message: "평가를 성공적으로 불러왔습니다." });
      }
    } catch {
      setAlert({ type: "error", message: "서버 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">1단계. 평가 코드 입력하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          평가 코드를 입력하세요
        </label>
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          placeholder="평가 코드 입력"
          onKeyDown={(e) => e.key === "Enter" && handleLookup()}
        />
        <button
          onClick={handleLookup}
          disabled={loading || loaded}
          className="mt-4 px-5 py-2.5 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm"
        >
          평가 코드 확인
        </button>
        {loading && <LoadingSpinner message="평가 코드 확인 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
