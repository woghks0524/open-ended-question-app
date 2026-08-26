"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTeacherCode } from "@/lib/teacher-client";

export default function SiteHeader() {
  const pathname = usePathname();
  // 학생 화면에서는 문항 목록 메뉴를 숨긴다
  const isStudent = pathname.startsWith("/student");
  // 목록 자체가 교사 전용이라, 교사 코드를 넣은 브라우저에만 보인다
  const teacherCode = useTeacherCode();

  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/" className="text-lg font-bold text-blue-600">
          AI 서술형 평가 도우미
        </Link>
        <nav className="flex gap-4 text-sm">
          <Link href="/teacher" className="text-gray-600 hover:text-blue-600 transition-colors">
            교사용
          </Link>
          <Link href="/student" className="text-gray-600 hover:text-blue-600 transition-colors">
            학생용
          </Link>
          {!isStudent && teacherCode && (
            <Link href="/questions" className="text-gray-600 hover:text-blue-600 transition-colors">
              문항 목록
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
