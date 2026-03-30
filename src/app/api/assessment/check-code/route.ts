import { NextRequest, NextResponse } from "next/server";
import { isCodeDuplicate } from "@/lib/google-sheets";

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();

    if (!code || /^\d+$/.test(code)) {
      return NextResponse.json(
        { error: "평가 코드에는 문자가 반드시 포함되어야 합니다." },
        { status: 400 }
      );
    }

    const isDuplicate = await isCodeDuplicate(code);
    if (isDuplicate) {
      return NextResponse.json(
        { error: "이미 존재하는 평가 코드입니다." },
        { status: 409 }
      );
    }

    return NextResponse.json({ available: true });
  } catch (e) {
    console.error("Check code error:", e);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
