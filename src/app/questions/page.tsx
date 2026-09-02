"use client";

import { useEffect, useMemo, useState } from "react";
import LoadingSpinner from "@/components/LoadingSpinner";
import AlertMessage from "@/components/AlertMessage";
import TeacherGate from "@/components/teacher/TeacherGate";
import { teacherFetch } from "@/lib/teacher-client";

interface Row {
  settingname: string;
  question1: string;
  question2: string;
  question3: string;
  subject: string;
  grade: string;
  semester: string;
  publisher: string;
  unit: string;
  timestamp: string;
  created_at: string;
}

type SortKey = "recent" | "subject" | "grade" | "code";

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "최신순" },
  { key: "subject", label: "과목순" },
  { key: "grade", label: "학년순" },
  { key: "code", label: "코드순" },
];

export default function QuestionsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  // 펼쳐진 카드들 — 기본은 문항1 두 줄 미리보기, 클릭하면 문항 1~3 전문
  const [openCodes, setOpenCodes] = useState<Set<string>>(new Set());
  const toggle = (code: string) =>
    setOpenCodes((prev) => {
      const nx = new Set(prev);
      if (nx.has(code)) nx.delete(code); else nx.add(code);
      return nx;
    });

  useEffect(() => {
    teacherFetch("/api/assessment/list")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setRows(data.rows);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "목록을 불러오지 못했습니다."));
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return [];
    const q = search.trim().toLowerCase();
    const matched = q
      ? rows.filter((r) =>
          [r.settingname, r.subject, r.grade, r.unit, r.question1, r.question2, r.question3]
            .join(" ")
            .toLowerCase()
            .includes(q)
        )
      : rows;

    const sorted = [...matched];
    if (sortKey === "subject") sorted.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
    else if (sortKey === "grade") sorted.sort((a, b) => Number(a.grade) - Number(b.grade));
    else if (sortKey === "code") sorted.sort((a, b) => a.settingname.localeCompare(b.settingname, "ko"));
    // "recent"는 API가 이미 최신순으로 내려줌
    return sorted;
  }, [rows, search, sortKey]);

  const questionCount = (r: Row) => [r.question1, r.question2, r.question3].filter(Boolean).length;

  // 문항 목록에는 어떤 평가가 출제됐는지 전부 드러나므로 교사 화면으로 잠근다
  return (
    <TeacherGate>
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-1">문항 목록</h1>
      <p className="text-sm text-gray-500 mb-6">지금까지 만들어진 서술형 평가 문항이에요.</p>

      {/* 검색 + 정렬 */}
      <div className="flex flex-wrap gap-3 mb-4 items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="코드, 과목, 단원, 문항 내용으로 검색..."
          className="flex-1 min-w-[220px] border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
        <div className="flex gap-1">
          {SORT_OPTIONS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`px-3 py-2 text-sm rounded-lg transition-colors ${
                sortKey === key
                  ? "bg-blue-500 text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!rows && !error && <LoadingSpinner message="문항 목록을 불러오는 중..." />}
      {error && <AlertMessage type="error" message={error} />}

      {rows && (
        <>
          <p className="text-xs text-gray-400 mb-3">{filtered.length}개 평가</p>
          <div className="space-y-3">
            {filtered.map((r) => (
              <div
                key={r.settingname}
                onClick={() => toggle(r.settingname)}
                className="bg-white rounded-lg border border-gray-200 p-5 cursor-pointer hover:border-blue-300 transition-colors"
              >
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-sm font-semibold text-blue-600">{r.settingname}</span>
                  {r.subject && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      {r.subject}
                    </span>
                  )}
                  {r.grade && (
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                      {r.grade}학년{r.semester && ` ${r.semester}학기`}
                    </span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">
                    문항 {questionCount(r)}개{r.timestamp && ` · ${r.timestamp}`}
                  </span>
                </div>
                {r.unit && <p className="text-xs text-gray-500 mb-1.5">{r.unit}</p>}
                {openCodes.has(r.settingname) ? (
                  <div className="space-y-3 mt-2">
                    {[r.question1, r.question2, r.question3].map(
                      (q, i) =>
                        q && (
                          <div key={i}>
                            <p className="text-xs font-semibold text-blue-500 mb-0.5">문항 {i + 1}</p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap">{q}</p>
                          </div>
                        )
                    )}
                    <p className="text-xs text-gray-400">접으려면 다시 클릭</p>
                  </div>
                ) : (
                  <p className="text-sm text-gray-700 line-clamp-2">
                    {r.question1}
                    <span className="text-xs text-gray-400 ml-2">(클릭하면 문항 전체가 보여요)</span>
                  </p>
                )}
              </div>
            ))}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 py-8 text-center">
                {search ? "검색 결과가 없어요." : "아직 만들어진 문항이 없어요."}
              </p>
            )}
          </div>
        </>
      )}
    </div>
    </TeacherGate>
  );
}
