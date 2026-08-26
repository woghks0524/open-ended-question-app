"use client";

import { useState } from "react";
import { teacherFetch } from "@/lib/teacher-client";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  settingName: string;
  onSettingNameChange: (name: string) => void;
  /** 기존 문항을 코드로 불러와 폼에 채우기 (선택 기능) */
  onImport: (data: Record<string, string>) => void;
}

export default function Step1Code({ settingName, onSettingNameChange, onImport }: Props) {
  const [input, setInput] = useState(settingName);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // 기존 문항 가져오기(선택)
  const [importCode, setImportCode] = useState("");
  const [importing, setImporting] = useState(false);
  const [importAlert, setImportAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleRegister = async () => {
    setAlert(null);
    if (!input || /^\d+$/.test(input)) {
      setAlert({ type: "error", message: "평가 코드에는 문자가 반드시 포함되어야 합니다. 숫자로만 이루어진 평가 코드는 사용할 수 없습니다." });
      return;
    }

    setLoading(true);
    try {
      const res = await teacherFetch("/api/assessment/check-code", {
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

  const handleImport = async () => {
    setImportAlert(null);
    if (!importCode.trim()) {
      setImportAlert({ type: "error", message: "가져올 문항의 코드를 입력해주세요." });
      return;
    }

    setImporting(true);
    try {
      const res = await teacherFetch(`/api/assessment?code=${encodeURIComponent(importCode.trim())}&full=1`);
      const data = await res.json();
      if (!res.ok) {
        setImportAlert({ type: "error", message: data.error || "해당 코드의 문항을 찾을 수 없습니다." });
      } else {
        onImport(data);
        const nQ = [data.question1, data.question2, data.question3].filter(Boolean).length;
        setImportAlert({
          type: "success",
          message: `'${importCode.trim()}'의 내용을 가져왔습니다 (문항 ${nQ}개, 단원: ${data.unit || "미지정"}). 교과서·단원 정보와 문항·모범답안·주의사항이 채워졌으니, 2~5단계는 확인만 하고 넘어가도 됩니다. 6단계에서 결과를 모을 선생님의 구글 시트 주소만 꼭 입력해주세요.`,
        });
      }
    } catch {
      setImportAlert({ type: "error", message: "서버 오류가 발생했습니다." });
    } finally {
      setImporting(false);
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

      {/* 기존 문항 가져오기 (선택) */}
      <div className="mt-4 bg-white rounded-lg border border-dashed border-gray-300 p-6">
        <p className="text-sm font-medium text-gray-700 mb-1">📥 기존 문항 내용 가져오기 (선택)</p>
        <p className="text-xs text-gray-500 mb-3">
          공유 문항(예: 생각교실4사06)이나 이전에 만든 평가의 코드를 입력하면 문항·모범답안·채점 주의사항이
          자동으로 채워집니다. 내용은 자유롭게 수정할 수 있고, 학생 결과는 6단계에서 입력하는 선생님의 구글
          시트로만 모입니다.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="가져올 문항 코드 입력 (예: 생각교실4사06)"
          />
          <button
            onClick={handleImport}
            disabled={importing}
            className="px-5 py-2.5 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:bg-gray-300 transition-colors text-sm whitespace-nowrap"
          >
            가져오기
          </button>
        </div>
        {importing && <LoadingSpinner message="문항 내용을 불러오는 중..." />}
        {importAlert && <AlertMessage type={importAlert.type} message={importAlert.message} />}
      </div>
    </div>
  );
}
