"use client";

import { useState } from "react";
import { teacherFetch } from "@/lib/teacher-client";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { BasicInfo } from "@/components/teacher/Step2BasicInfo";

interface Props {
  settingName: string;
  info: BasicInfo;
  questions: string[];
  correctAnswers: string[];
  images: string[];
  feedbackInstruction: string;
  extraVectorStoreId: string;
  sheetUrl: string;
  onSheetUrlChange: (url: string) => void;
}

export default function Step6Review({
  settingName,
  info,
  questions,
  correctAnswers,
  images,
  feedbackInstruction,
  extraVectorStoreId,
  sheetUrl,
  onSheetUrlChange,
}: Props) {
  const [verifyResult, setVerifyResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localSheetUrl, setLocalSheetUrl] = useState(sheetUrl);
  const [alert, setAlert] = useState<{ type: "success" | "error" | "warning"; message: string } | null>(null);
  const [missingConfirmed, setMissingConfirmed] = useState(false);

  // 모범답안이 비어 있는 문항 번호.
  //
  // 채점 기준이 모범답안에 걸려 있다. 모범답안이 있으면 "이 문항의 답은 낱말인가
  // 문장인가"를 코드가 정해 늘 같은 기준으로 채점하지만, 비어 있으면 그 판단이
  // 모델 몫으로 넘어가 채점할 때마다 흔들린다. 같은 답을 쓴 두 학생이 다른 점수를
  // 받을 수 있다는 뜻이라, 저장 전에 알린다. 다만 막지는 않는다 —
  // "뒷이야기를 상상해 써보세요" 같은 창작 문항은 정답이 없는 것이 옳다.
  const missingAnswers = questions
    .map((q, i) => (q.trim() && !(correctAnswers[i] || "").trim() ? i + 1 : 0))
    .filter(Boolean);

  const handleVerify = async () => {
    setLoading(true);
    setAlert(null);
    setVerifyResult("");

    try {
      const res = await teacherFetch("/api/assessment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          questions,
          correctAnswers,
          feedbackInstruction,
          unitKey: info.unitKey,
          extraVectorStoreId,
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error);
      setVerifyResult(data.result);
    } catch (e) {
      setAlert({ type: "error", message: `확인 중 오류: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!localSheetUrl) {
      setAlert({ type: "error", message: "구글 시트 사본 URL을 입력해주세요." });
      return;
    }

    // 한 번은 알리고, 그래도 저장하겠다고 하면 그대로 진행한다
    if (missingAnswers.length && !missingConfirmed) {
      setMissingConfirmed(true);
      setAlert({
        type: "warning",
        message: `${missingAnswers.join("·")}번 문항에 모범답안이 비어 있습니다. 모범답안은 채점의 기준이라, 없으면 그 문항의 채점 결과가 학생마다 조금씩 달라질 수 있습니다. 4단계에서 채워주시거나, 정답이 정해지지 않는 문항(상상하여 쓰기 등)이라면 그대로 저장하셔도 됩니다. 저장하려면 한 번 더 눌러주세요.`,
      });
      return;
    }

    setSaving(true);
    setAlert(null);
    onSheetUrlChange(localSheetUrl);

    try {
      const now = new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
      const res = await teacherFetch("/api/assessment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timestamp: now,
          settingname: settingName,
          question1: questions[0],
          question2: questions[1],
          question3: questions[2],
          image1: images[0],
          image2: images[1],
          image3: images[2],
          correctanswer1: correctAnswers[0],
          correctanswer2: correctAnswers[1],
          correctanswer3: correctAnswers[2],
          feedbackinstruction: feedbackInstruction,
          unitkey: info.unitKey,
          grade: info.grade,
          semester: info.semester,
          subject: info.subject,
          publisher: info.publisher,
          unit: info.unit,
          vectorapi: extraVectorStoreId,
          sheeturl: localSheetUrl,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }

      setAlert({ type: "success", message: "최종적으로 서술형 평가 문항 시트에 저장하였습니다." });
    } catch (e) {
      setAlert({ type: "error", message: `저장 실패: ${e instanceof Error ? e.message : "알 수 없는 오류"}` });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">6단계. 확인 및 저장하기</h2>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
        {/* 평가 내용 확인 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">평가 내용 확인하기</h3>
          <button
            onClick={handleVerify}
            disabled={loading}
            className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
          >
            평가 내용 확인
          </button>
          {loading && <LoadingSpinner message="AI가 평가 내용을 확인하고 있습니다..." />}
          {verifyResult && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-sm whitespace-pre-wrap border">
              {verifyResult}
            </div>
          )}
        </div>

        {/* 업로드한 이미지 */}
        {images.some((img) => img) && (
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-3">업로드한 문항 이미지</h3>
            <div className="flex gap-4 flex-wrap">
              {images.map(
                (img, i) =>
                  img && (
                    <img
                      key={i}
                      src={img}
                      alt={`${i + 1}번 문항 이미지`}
                      className="max-w-[200px] rounded-lg border"
                    />
                  )
              )}
            </div>
          </div>
        )}

        <hr className="border-gray-200" />

        {/* 시트 설정 */}
        <div>
          <h3 className="text-sm font-medium text-gray-700 mb-3">학생 평가 데이터를 개인 시트에 저장하기</h3>
          <ol className="list-decimal list-inside text-sm text-gray-600 space-y-2 mb-4">
            <li>
              서술형 평가 데이터 시트 사본 생성 -{" "}
              <a
                href="https://docs.google.com/spreadsheets/d/1XlCluRLywg79zQuVC-wiSlcSZ3imkQLdU6ldfvN1UHE/copy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline"
              >
                구글 시트 사본 만들기
              </a>
            </li>
            <li>
              아래 계정에 <strong>편집자</strong> 권한 부여하기
              <code className="block mt-1 px-3 py-1.5 bg-gray-100 rounded text-xs">
                streamlit@m20223715.iam.gserviceaccount.com
              </code>
            </li>
            <li>구글 시트 사본 URL 입력하기</li>
          </ol>

          <input
            type="text"
            value={localSheetUrl}
            onChange={(e) => setLocalSheetUrl(e.target.value)}
            placeholder="구글 시트 사본의 URL을 복사하여 전부 입력해주세요."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <hr className="border-gray-200" />

        {missingAnswers.length > 0 && (
          <div className="p-3 rounded-lg border bg-yellow-50 border-yellow-200 text-yellow-800 text-sm">
            <strong>{missingAnswers.join("·")}번 문항에 모범답안이 없습니다.</strong>
            <br />
            모범답안은 채점의 기준이 됩니다. 비워두면 그 문항은 채점 결과가 학생마다 조금씩
            달라질 수 있습니다. 4단계에서 채워주시는 편이 좋습니다.
            <br />
            <span className="text-yellow-700">
              다만 &lsquo;상상하여 뒷이야기 쓰기&rsquo;처럼 정답이 정해지지 않는 문항이라면 비워두는 것이 맞습니다.
            </span>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-300 transition-colors text-sm font-medium"
        >
          {missingAnswers.length > 0 && missingConfirmed ? "모범답안 없이 저장" : "서술형 평가 저장"}
        </button>
        {saving && <LoadingSpinner message="저장 중..." />}
        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
