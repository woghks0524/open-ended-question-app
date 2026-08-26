import { NextRequest, NextResponse } from "next/server";
import { listAssessments } from "@/lib/assessments";
import { requireTeacher } from "@/lib/teacher-auth";

// GET: 교사용 문항 목록 (민감 컬럼 제외 — listAssessments가 걸러서 내려줌)
// 민감 컬럼을 빼도 어떤 문항이 출제됐는지 전부 보이므로 학생에게 열어둘 목록이 아니다.
export async function GET(req: NextRequest) {
  const denied = requireTeacher(req);
  if (denied) return denied;

  try {
    const rows = await listAssessments();
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("Assessment list error:", e);
    return NextResponse.json({ error: "문항 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
