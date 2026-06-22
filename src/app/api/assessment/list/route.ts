import { NextResponse } from "next/server";
import { listAssessments } from "@/lib/google-sheets";

// GET: 만들어진 평가 전체 목록(공유용)
export async function GET() {
  try {
    const assessments = await listAssessments();
    return NextResponse.json({ assessments });
  } catch (e) {
    console.error("Assessment list error:", e);
    return NextResponse.json({ error: "목록을 불러오지 못했습니다." }, { status: 500 });
  }
}
