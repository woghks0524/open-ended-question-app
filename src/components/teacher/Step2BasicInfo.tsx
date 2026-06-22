"use client";

import { useState } from "react";
import AlertMessage from "@/components/AlertMessage";
import catalog from "@/data/textbook-catalog.json";

type Unit = { unit: string; unitRaw: string; key: string };
type Catalog = Record<string, Record<string, Record<string, Record<string, Unit[]>>>>;
const CAT = catalog as Catalog;

const SUBJECT_ORDER = ["국어", "수학", "사회", "과학"];
const sortSubjects = (arr: string[]) =>
  [...arr].sort((a, b) => SUBJECT_ORDER.indexOf(a) - SUBJECT_ORDER.indexOf(b));

export interface BasicInfo {
  grade: string;
  semester: string;
  subject: string;
  publisher: string;
  unit: string;
  unitKey: string;
}

interface Props {
  value: BasicInfo;
  onSave: (v: BasicInfo) => void;
}

const selectCls =
  "w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400";

export default function Step2BasicInfo({ value, onSave }: Props) {
  const [grade, setGrade] = useState(value.grade || "");
  const [semester, setSemester] = useState(value.semester || "");
  const [subject, setSubject] = useState(value.subject || "");
  const [publisher, setPublisher] = useState(value.publisher || "");
  const [unitKey, setUnitKey] = useState(value.unitKey || "");
  const [alert, setAlert] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const grades = Object.keys(CAT).sort();
  const semesters = grade ? Object.keys(CAT[grade] || {}).sort() : [];
  const subjects = grade && semester ? sortSubjects(Object.keys(CAT[grade]?.[semester] || {})) : [];
  const publishers =
    grade && semester && subject ? Object.keys(CAT[grade]?.[semester]?.[subject] || {}) : [];
  const units: Unit[] =
    grade && semester && subject && publisher
      ? CAT[grade]?.[semester]?.[subject]?.[publisher] || []
      : [];

  const pickGrade = (v: string) => { setGrade(v); setSemester(""); setSubject(""); setPublisher(""); setUnitKey(""); };
  const pickSemester = (v: string) => { setSemester(v); setSubject(""); setPublisher(""); setUnitKey(""); };
  const pickSubject = (v: string) => { setSubject(v); setPublisher(""); setUnitKey(""); };
  const pickPublisher = (v: string) => { setPublisher(v); setUnitKey(""); };

  const handleSave = () => {
    if (!unitKey) {
      setAlert({ type: "error", message: "학년부터 단원까지 모두 선택해주세요." });
      return;
    }
    const u = units.find((x) => x.key === unitKey);
    onSave({ grade, semester, subject, publisher, unit: u?.unitRaw || "", unitKey });
    setAlert({ type: "success", message: "선택이 저장되었습니다." });
  };

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">2단계. 교과서·단원 선택하기</h2>
      <p className="text-sm text-gray-500 mb-4">
        학년 → 학기 → 과목 → 출판사 → 단원 순서로 고르면, 그 단원 교과서 자료를 바탕으로 채점합니다.
      </p>
      <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학년</label>
          <select value={grade} onChange={(e) => pickGrade(e.target.value)} className={selectCls}>
            <option value="">선택</option>
            {grades.map((v) => (<option key={v} value={v}>{v}학년</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">학기</label>
          <select value={semester} onChange={(e) => pickSemester(e.target.value)} disabled={!grade} className={selectCls}>
            <option value="">선택</option>
            {semesters.map((v) => (<option key={v} value={v}>{v}학기</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">과목</label>
          <select value={subject} onChange={(e) => pickSubject(e.target.value)} disabled={!semester} className={selectCls}>
            <option value="">선택</option>
            {subjects.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">출판사</label>
          <select value={publisher} onChange={(e) => pickPublisher(e.target.value)} disabled={!subject} className={selectCls}>
            <option value="">선택</option>
            {publishers.map((v) => (<option key={v} value={v}>{v}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">단원</label>
          <select value={unitKey} onChange={(e) => setUnitKey(e.target.value)} disabled={!publisher} className={selectCls}>
            <option value="">선택</option>
            {units.map((u) => (<option key={u.key} value={u.key}>{u.unitRaw}</option>))}
          </select>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-sm"
        >
          선택 저장
        </button>

        {alert && <AlertMessage type={alert.type} message={alert.message} />}
      </div>
    </div>
  );
}
