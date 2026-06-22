import { NextResponse } from "next/server";
import { getQuestionSheetUrl } from "@/lib/google-sheets";

// GET /sheet → 만들어진 평가 문항 마스터 시트(구글 시트)로 바로 이동
export async function GET() {
  try {
    const url = await getQuestionSheetUrl();
    return NextResponse.redirect(url);
  } catch (e) {
    console.error("Sheet redirect error:", e);
    return NextResponse.json({ error: "시트 주소를 불러오지 못했습니다." }, { status: 500 });
  }
}
