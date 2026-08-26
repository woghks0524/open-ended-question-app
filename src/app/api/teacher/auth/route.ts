import { NextRequest, NextResponse } from "next/server";
import { isTeacherCodeValid } from "@/lib/teacher-auth";

// POST: 교사 접속 코드가 맞는지만 확인한다 (잠금 화면 전용).
// 코드를 브라우저에 저장하기 전에 한 번 물어보는 용도라 다른 일은 하지 않는다.
export async function POST(req: NextRequest) {
  if (!process.env.TEACHER_ACCESS_CODE) {
    return NextResponse.json(
      { error: "교사 접속 코드가 서버에 설정되어 있지 않습니다. 관리자에게 문의해주세요. (TEACHER_ACCESS_CODE)" },
      { status: 503 }
    );
  }

  try {
    const { code } = await req.json();
    if (!isTeacherCodeValid(code)) {
      return NextResponse.json({ error: "교사 접속 코드가 올바르지 않습니다." }, { status: 401 });
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "요청을 읽지 못했습니다." }, { status: 400 });
  }
}
