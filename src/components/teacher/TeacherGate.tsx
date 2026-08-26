"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import LoadingSpinner from "@/components/LoadingSpinner";
import { setTeacherCode, useTeacherCode } from "@/lib/teacher-client";

/**
 * 교사용 화면 잠금. 저장된 접속 코드가 없으면 입력을 받고, 서버에서 확인된
 * 뒤에만 안쪽 화면을 보여준다.
 *
 * 이건 화면 가리개일 뿐이고 실제 방어는 서버 라우트에 있다(lib/teacher-auth.ts).
 * 브라우저에서 이 컴포넌트를 우회해도 API가 401을 낸다.
 */
export default function TeacherGate({ children }: { children: React.ReactNode }) {
  // 저장된 코드가 있으면 잠금 해제. 서버 렌더에서는 항상 잠긴 상태로 나가고,
  // 브라우저가 붙는 순간 저장된 값으로 다시 그려진다.
  const saved = useTeacherCode();

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!code.trim()) {
      setError("교사 접속 코드를 입력해주세요.");
      return;
    }

    setChecking(true);
    try {
      const res = await fetch("/api/teacher/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "확인하지 못했습니다.");
        return;
      }
      setTeacherCode(code.trim());   // 이 순간 useTeacherCode가 다시 읽어 잠금이 풀린다
    } catch {
      setError("서버 오류가 발생했습니다.");
    } finally {
      setChecking(false);
    }
  };

  if (saved) return <>{children}</>;

  return (
    <div className="max-w-md mx-auto mt-10">
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-3xl mb-3">🔒</div>
        <h1 className="text-xl font-semibold text-gray-900 mb-2">교사용 화면</h1>
        <p className="text-sm text-gray-500 mb-6">
          문항과 모범답안을 다루는 화면이라 접속 코드가 필요합니다. 한 번 입력하면 이
          브라우저에 기억되어 다음부터는 묻지 않습니다.
          <br />
          <span className="text-gray-400">학생은 코드 없이 학생용 화면을 그대로 쓸 수 있습니다.</span>
        </p>

        <form onSubmit={submit}>
          <input
            type="password"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            autoComplete="current-password"
            placeholder="교사 접속 코드"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={checking}
            className="mt-4 w-full px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors text-sm"
          >
            들어가기
          </button>
        </form>

        {checking && <LoadingSpinner message="확인 중..." />}
        {error && <AlertMessage type="error" message={error} />}
      </div>
    </div>
  );
}
