"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Props {
  questions: string[];
  correctAnswers: string[];
  images: string[];
  onSave: (questions: string[], correctAnswers: string[], images: string[]) => void;
}

export default function Step4Questions({ questions, correctAnswers, images, onSave }: Props) {
  const [qs, setQs] = useState(questions);
  const [ans, setAns] = useState(correctAnswers);
  const [imgs, setImgs] = useState(images);
  const [imageFiles, setImageFiles] = useState<(File | null)[]>([null, null, null]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const updateQ = (idx: number, val: string) => {
    const next = [...qs];
    next[idx] = val;
    setQs(next);
  };

  const updateA = (idx: number, val: string) => {
    const next = [...ans];
    next[idx] = val;
    setAns(next);
  };

  const updateFile = (idx: number, file: File | null) => {
    const next = [...imageFiles];
    next[idx] = file;
    setImageFiles(next);
  };

  const handleRegister = async () => {
    setLoading(true);
    setAlert(null);

    try {
      // 이미지 업로드
      const uploadedUrls = [...imgs];
      for (let i = 0; i < 3; i++) {
        const file = imageFiles[i];
        if (file) {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("prefix", `q${i + 1}`);

          const res = await fetch("/api/upload", { method: "POST", body: formData });
          const data = await res.json();
          if (res.ok) {
            uploadedUrls[i] = data.url;
          }
        }
      }

      setImgs(uploadedUrls);
      onSave(qs, ans, uploadedUrls);
      setAlert({ type: "success", message: "서술형 평가 문항이 저장되었습니다." });
    } catch {
      setAlert({ type: "error", message: "저장 중 오류가 발생했습니다." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">4단계. 평가 문항 입력하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-6">
          {[0, 1, 2].map((i) => (
            <div key={i} className="border border-gray-100 rounded-lg p-4 bg-gray-50">
              <h3 className="font-medium text-sm text-gray-700 mb-3">{i + 1}번 문항</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">문항</label>
                  <textarea
                    value={qs[i]}
                    onChange={(e) => updateQ(i, e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">모범 답안</label>
                  <textarea
                    value={ans[i]}
                    onChange={(e) => updateA(i, e.target.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">문항 이미지</label>
                  <input
                    type="file"
                    accept="image/jpg,image/jpeg,image/png"
                    onChange={(e) => updateFile(i, e.target.files?.[0] || null)}
                    className="block w-full text-xs text-gray-500 file:mr-2 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:bg-blue-50 file:text-blue-700"
                  />
                  {imgs[i] && (
                    <img src={imgs[i]} alt={`${i + 1}번 이미지`} className="mt-2 max-w-[120px] rounded" />
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleRegister}
          disabled={loading}
          className="mt-6 px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
        >
          문항 등록
        </button>
        {loading && <LoadingSpinner message="이미지 업로드 및 문항 저장 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
