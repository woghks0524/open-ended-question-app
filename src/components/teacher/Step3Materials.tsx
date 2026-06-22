"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  settingName: string;
  unitKey: string;
  extraVectorStoreId: string;
  onExtraVectorStore: (vectorStoreId: string) => void;
}

export default function Step3Materials({
  settingName,
  unitKey,
  extraVectorStoreId,
  onExtraVectorStore,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "info"; message: string } | null>(null);

  const handleUpload = async () => {
    if (!uploadFile) return;
    setLoading(true);
    setAlert(null);

    try {
      const fd = new FormData();
      fd.append("file", uploadFile);
      fd.append("unitKey", unitKey);
      fd.append("settingName", settingName);
      if (extraVectorStoreId) fd.append("vectorStoreId", extraVectorStoreId);

      const res = await fetch("/api/vectorstore", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      onExtraVectorStore(data.vectorStoreId);
      setUploaded((u) => [...u, uploadFile.name]);
      setUploadFile(null);
      setAlert({ type: "success", message: `'${uploadFile.name}' 추가 완료. 더 올리거나 다음으로 넘어가세요.` });
    } catch (e) {
      setAlert({ type: "error", message: `업로드 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">3단계. 추가 자료 올리기 (선택)</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div className="rounded-lg bg-blue-50 border border-blue-100 p-4 text-sm text-blue-800">
          선택한 단원의 <strong>교과서 자료는 기본으로 채점에 사용</strong>됩니다.
          수업 때 쓴 학습지·자료(PDF 등)를 추가로 올리면, 이 평가에 한해 함께 참고합니다.
          <span className="block mt-1 text-blue-600">올리지 않아도 됩니다 — 그러면 교과서 자료만으로 채점합니다.</span>
        </div>

        <div>
          <input
            type="file"
            onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
            className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {uploadFile && !loading && (
            <button
              onClick={handleUpload}
              className="mt-3 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
            >
              '{uploadFile.name}' 올리기
            </button>
          )}
        </div>

        {uploaded.length > 0 && (
          <div className="text-sm text-gray-600">
            <p className="font-medium mb-1">올린 자료</p>
            <ul className="list-disc list-inside">
              {uploaded.map((n, i) => (<li key={i}>{n}</li>))}
            </ul>
          </div>
        )}

        {loading && <LoadingSpinner message="자료 업로드 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
