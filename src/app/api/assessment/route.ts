import { NextRequest, NextResponse } from "next/server";
import { lookupAssessment, saveAssessment } from "@/lib/assessments";

// 학생 화면에 내려보내면 안 되는 컬럼 (모범답안·채점지침·교사 결과시트 등)
const SENSITIVE_FIELDS = [
  "sheeturl",
  "correctanswer1",
  "correctanswer2",
  "correctanswer3",
  "feedbackinstruction",
  "vectorapi",
];

// GET: 평가 코드로 평가 조회
// 기본(학생용): 문항·이미지 등 공개 필드만 반환. 채점·저장에 필요한 민감 값은 서버가 직접 조회.
// full=1(교사용 가져오기): 전체 반환.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const full = req.nextUrl.searchParams.get("full") === "1";
  if (!code) {
    return NextResponse.json({ error: "평가 코드를 입력하세요." }, { status: 400 });
  }

  try {
    const data = await lookupAssessment(code);
    if (!data) {
      return NextResponse.json({ error: "평가 코드를 다시 확인해주세요." }, { status: 404 });
    }
    if (full) return NextResponse.json(data);
    const safe = Object.fromEntries(
      Object.entries(data).filter(([k]) => !SENSITIVE_FIELDS.includes(k))
    );
    return NextResponse.json(safe);
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
