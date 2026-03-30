import { NextRequest, NextResponse } from "next/server";
import { lookupAssessment, saveAssessment } from "@/lib/google-sheets";

// GET: 평가 코드로 평가 조회 (학생용)
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "평가 코드를 입력하세요." }, { status: 400 });
  }

  try {
    const data = await lookupAssessment(code);
    if (!data) {
      return NextResponse.json({ error: "평가 코드를 다시 확인해주세요." }, { status: 404 });
    }
    return NextResponse.json(data);
  } catch (e) {
    console.error("Assessment lookup error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}

// POST: 평가 저장 (교사용)
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    await saveAssessment(body);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Assessment save error:", e);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
