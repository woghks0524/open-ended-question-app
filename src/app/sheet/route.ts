import { NextRequest, NextResponse } from "next/server";

// 문항이 구글 시트 → Supabase로 옮겨가면서 시트 링크 대신 앱 내 문항 목록으로 안내
export async function GET(req: NextRequest) {
  return NextResponse.redirect(new URL("/questions", req.url));
}
