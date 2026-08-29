import { NextRequest, NextResponse } from "next/server";
import { isOpenMode, isTeacherCodeValid } from "@/lib/teacher-auth";

// POST: 교사 접속 코드가 맞는지만 확인한다 (잠금 화면 전용).
// 코드를 브라우저에 저장하기 전에 한 번 물어보는 용도라 다른 일은 하지 않는다.
// 개방 모드(개발 중)면 무엇이든 통과 — TeacherGate가 이걸로 잠금 없이 열린다.
export async function POST(req: NextRequest) {
  if (isOpenMode()) {
    return NextResponse.json({ ok: true, open: true });
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
