import { NextRequest, NextResponse } from "next/server";
import { saveResults } from "@/lib/google-sheets";

// POST: 학생 결과 저장
export async function POST(req: NextRequest) {
  try {
    const { sheetUrl, rowData } = await req.json();

    if (!sheetUrl) {
      return NextResponse.json({ error: "시트 URL이 필요합니다." }, { status: 400 });
    }

    await saveResults(sheetUrl, rowData);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("Results save error:", e);
    return NextResponse.json({ error: "저장 중 오류가 발생했습니다." }, { status: 500 });
  }
}
