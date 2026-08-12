import { NextRequest, NextResponse } from "next/server";
import { lookupAssessment, saveResults } from "@/lib/google-sheets";

// POST: 학생 결과 저장
// 교사 결과시트 URL은 클라이언트에 노출하지 않고, 평가 코드로 서버에서 직접 찾아 저장한다.
export async function POST(req: NextRequest) {
  try {
    const { code, rowData } = await req.json();

    if (!code) {
      return NextResponse.json({ error: "평가 코드가 필요합니다." }, { status: 400 });
    }

    const assessment = await lookupAssessment(code);
    if (!assessment) {
      return NextResponse.json({ error: "평가 코드를 다시 확인해주세요." }, { status: 404 });
    }
    const sheetUrl = assessment.sheeturl;
    if (!sheetUrl) {
      return NextResponse.json(
        { error: "이 평가에는 결과 저장용 시트가 설정되어 있지 않습니다. (연습용 공용 문항일 수 있어요)" },
        { status: 400 }
      );
    }

    await saveResults(sheetUrl, rowData);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Results save error:", e);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
