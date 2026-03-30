"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  settingName: string;
  teacherAssistantId: string;
  studentAssistantId: string;
  defaultVectorStoreId: string;
  onResourcesCreated: (data: {
    vectorStoreId: string;
    teacherAssistantId: string;
    studentAssistantId: string;
  }) => void;
  onUseExisting: (vectorStoreId: string) => void;
}

export default function Step3Materials({
  settingName,
  teacherAssistantId,
  studentAssistantId,
  defaultVectorStoreId,
  onResourcesCreated,
  onUseExisting,
}: Props) {
  const [mode, setMode] = useState<"existing" | "new" | null>(null);
  const [loading, setLoading] = useState(false);
  const [newVectorStoreId, setNewVectorStoreId] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleExisting = () => {
    setMode("existing");
    onUseExisting(defaultVectorStoreId);
    setAlert({ type: "success", message: "기존에 입력된 평가 참고자료(교과서, 교육과정 문서)를 사용합니다." });
  };

  const handleNew = async () => {
    setMode("new");
    setLoading(true);
    setAlert(null);

    try {
      const res = await fetch("/api/vectorstore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          settingName,
          teacherAssistantId,
          studentAssistantId,
          defaultVectorStoreId,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);

      setNewVectorStoreId(data.vectorStoreId);
      onResourcesCreated(data);
      setAlert({ type: "success", message: "새 평가 참고자료 환경이 생성되었습니다. 추가 자료를 업로드할 수 있습니다." });
    } catch (e) {
      setAlert({ type: "error", message: `생성 중 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async () => {
    if (!uploadFile || !newVectorStoreId) return;

    setLoading(true);
    setAlert(null);

    try {
      // 1. OpenAI에 파일 업로드 (서버 API를 통해)
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("prefix", "ref");

      // 파일을 서버로 전송하여 OpenAI에 업로드
      const res = await fetch("/api/vectorstore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "uploadFile",
          vectorStoreId: newVectorStoreId,
          fileName: uploadFile.name,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setAlert({ type: "success", message: "추가 자료가 업로드 되었습니다." });
      setUploadFile(null);
    } catch (e) {
      setAlert({ type: "error", message: `업로드 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">3단계. 평가 참고자료 입력하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        {!mode && (
          <div className="space-y-3">
            <button
              onClick={handleExisting}
              className="w-full text-left px-5 py-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm"
            >
              📁 기존에 입력되어 있는 평가 참고자료(교과서, 교육과정 문서)만 평가에 활용할 때 사용
            </button>
            <button
              onClick={handleNew}
              className="w-full text-left px-5 py-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-all text-sm"
            >
              🆕 새로운 평가 참고자료(pdf 등)을 업로드하여 평가에 활용할 때 사용
            </button>
          </div>
        )}

        {mode === "existing" && (
          <div className="text-sm text-gray-600">
            기존 참고자료를 사용합니다.
          </div>
        )}

        {mode === "new" && !loading && newVectorStoreId && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600">추가 참고자료를 업로드할 수 있습니다.</p>
            <input
              type="file"
              onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
            {uploadFile && (
              <button
                onClick={handleUpload}
                className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
              >
                업로드
              </button>
            )}
          </div>
        )}

        {loading && <LoadingSpinner message="참고자료 환경 생성 중... (시간이 걸릴 수 있습니다)" />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
