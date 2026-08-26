import { NextResponse } from "next/server";
import { listAssessments } from "@/lib/assessments";

// GET: 교사용 문항 목록 (민감 컬럼 제외 — listAssessments가 걸러서 내려줌)
export async function GET() {
  try {
    const rows = await listAssessments();
    return NextResponse.json({ rows });
  } catch (e) {
    console.error("Assessment list error:", e);
    return NextResponse.json({ error: "문항 목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
