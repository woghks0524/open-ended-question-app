"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import LoadingSpinner from "@/components/LoadingSpinner";

interface Assessment {
  code: string;
  grade: string;
  semester: string;
  subject: string;
  publisher: string;
  unit: string;
  questions: string[];
  timestamp: string;
}

export default function AssessmentsPage() {
  const [list, setList] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [gradeFilter, setGradeFilter] = useState<string>("전체");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/assessment/list")
      .then((r) => r.json())
      .then((d) => {
        if (d.error) throw new Error(d.error);
        setList(d.assessments || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const grades = useMemo(() => {
    const gs = Array.from(new Set(list.map((a) => a.grade).filter(Boolean))).sort();
    return ["전체", ...gs];
  }, [list]);

  const filtered = useMemo(
    () => (gradeFilter === "전체" ? list : list.filter((a) => a.grade === gradeFilter)),
    [list, gradeFilter]
  );

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied(""), 1500);
    } catch {}
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">만들어진 평가 문항 목록</h1>
      <p className="text-sm text-gray-500 mb-6">
        다른 선생님이 만든 평가도 코드로 함께 사용할 수 있어요. 학년별로 골라보세요.
      </p>

      {loading && <LoadingSpinner message="목록을 불러오는 중..." />}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          {/* 학년 필터 */}
          <div className="flex gap-2 flex-wrap mb-5">
            {grades.map((g) => (
              <button
                key={g}
                onClick={() => setGradeFilter(g)}
                className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                  gradeFilter === g
                    ? "bg-blue-500 text-white border-blue-500"
                    : "bg-white text-gray-600 border-gray-300 hover:border-blue-300"
                }`}
              >
                {g === "전체" ? "전체" : `${g}학년`}
              </button>
            ))}
          </div>

          <p className="text-xs text-gray-400 mb-3">총 {filtered.length}개</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {filtered.map((a, i) => (
              <div key={`${a.code}-${i}`} className="bg-white rounded-lg border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-1 rounded">{a.code}</span>
                    <button
                      onClick={() => copyCode(a.code)}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      {copied === a.code ? "복사됨 ✓" : "코드 복사"}
                    </button>
                  </div>
                </div>

                {(a.subject || a.unit) && (
                  <p className="text-sm text-gray-700 mb-2">
                    {[a.grade && `${a.grade}학년`, a.semester && `${a.semester}학기`, a.subject, a.publisher]
                      .filter(Boolean)
                      .join(" · ")}
                    {a.unit && <span className="font-medium"> · {a.unit}</span>}
                  </p>
                )}

                {a.questions.length > 0 && (
                  <ul className="text-sm text-gray-600 list-disc list-inside space-y-1">
                    {a.questions.map((q, qi) => (
                      <li key={qi} className="line-clamp-2">{q}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          {filtered.length === 0 && (
            <p className="text-sm text-gray-500">해당 학년의 평가가 아직 없어요.</p>
          )}

          <div className="mt-8">
            <Link href="/student" className="text-sm text-blue-500 hover:underline">
              → 학생용 페이지에서 코드 입력하고 풀기
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
