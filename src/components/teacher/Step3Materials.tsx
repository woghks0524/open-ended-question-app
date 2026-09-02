"use client";

import { useState } from "react";
import { teacherFetch } from "@/lib/teacher-client";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  settingName: string;
  unitKey: string;
  extraVectorStoreId: string;
  /** 이 보관함이 '가져오기'로 온 원본 문항의 것인가 (그러면 복사해서 씀) */
  vectorStoreImported: boolean;
  onExtraVectorStore: (vectorStoreId: string) => void;
}

export default function Step3Materials({
  settingName,
  unitKey,
  extraVectorStoreId,
  vectorStoreImported,
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
      if (extraVectorStoreId) {
        // 가져온 문항의 보관함이면 거기에 쓰지 않는다 — 원본 주인의 채점이 바뀐다.
        // 서버가 사본 보관함을 만들어(원본 파일 참조 복사) 새 파일을 거기 담는다.
        fd.append(vectorStoreImported ? "copyFrom" : "vectorStoreId", extraVectorStoreId);
      }

      const res = await teacherFetch("/api/vectorstore", { method: "POST", body: fd });
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

        {/* 가져온 문항에 딸려온 원본 참고자료 — 원치 않으면 여기서 뗀다 */}
        {vectorStoreImported && extraVectorStoreId && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 flex items-start justify-between gap-3">
            <div>
              📎 <strong>원본 문항의 참고자료가 연결되어 있습니다.</strong>
              <span className="block mt-1 text-amber-700">
                그대로 두면 원본 교사가 올린 자료도 채점에 함께 쓰입니다. 우리 반과 맞지 않으면
                연결을 해제하세요 — 교과서 자료만으로 채점하게 됩니다. (원본 문항에는 영향 없음)
              </span>
            </div>
            <button
              onClick={() => {
                onExtraVectorStore("");
                setAlert({ type: "info", message: "원본 참고자료 연결을 해제했습니다. 이제 교과서 자료(와 직접 올리는 자료)만으로 채점합니다." });
              }}
              className="shrink-0 px-3 py-1.5 bg-white border border-amber-300 text-amber-700 rounded-lg hover:bg-amber-100 transition-colors text-xs whitespace-nowrap"
            >
              연결 해제
            </button>
          </div>
        )}

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
              &lsquo;{uploadFile.name}&rsquo; 올리기
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
