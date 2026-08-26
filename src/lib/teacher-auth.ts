import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";

// 교사 전용 라우트 보호.
//
// 이 앱에는 계정이 없다. 학생은 평가 코드만으로 들어오고, 그건 그대로 둔다.
// 문제는 교사 기능까지 무인증이었다는 것이다 —
//   · 모범답안·채점지침·결과시트 URL 조회(full=1)
//   · 마스터 시트에 문항 쓰기
//   · OpenAI/Firebase 비용이 발생하는 업로드·AI 확인
// 학생은 자기 평가 코드를 알고 있으므로, full=1 하나면 정답이 그대로 보였다.
//
// 그래서 공유 비밀 하나(TEACHER_ACCESS_CODE)로 교사 경로만 막는다.
// 계정 시스템이 아니라 "학생이 실수로/호기심에 넘어오지 못하게" 하는 문턱이다.
// 연수에서 코드를 공유하면 다른 선생님도 그대로 쓸 수 있다.

export const TEACHER_HEADER = "x-teacher-code";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf-8");
  const bb = Buffer.from(b, "utf-8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** 퍼센트 인코딩을 푼다. 코드에 %가 그냥 들어 있어 못 풀면 원문 그대로 본다. */
function decodeCode(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

/** 코드가 맞는지만 판정한다 (인증 라우트에서 재사용). */
export function isTeacherCodeValid(code: string | null | undefined): boolean {
  const expected = process.env.TEACHER_ACCESS_CODE;
  if (!expected) return false;
  return safeEqual(code || "", expected);
}

/**
 * 교사 전용 라우트 가드. 통과하면 null, 막히면 그대로 반환할 응답을 돌려준다.
 *
 * 헤더(x-teacher-code)로 받는 게 기본이고, 쿼리 파라미터 t 도 받는다.
 * `<a href="/sheet">` 처럼 헤더를 실을 수 없는 링크 이동 때문이다.
 *
 * 환경변수가 비어 있으면 통과시키지 않는다. 기본값을 '열림'으로 두면 배포 때
 * 설정을 잊는 순간 구멍이 조용히 그대로 남는다.
 */
export function requireTeacher(req: NextRequest): NextResponse | null {
  if (!process.env.TEACHER_ACCESS_CODE) {
    return NextResponse.json(
      { error: "교사 접속 코드가 서버에 설정되어 있지 않습니다. (환경변수 TEACHER_ACCESS_CODE)" },
      { status: 503 }
    );
  }

  // 헤더는 퍼센트 인코딩되어 온다(한글 코드가 헤더에서 깨지므로). 쿼리 파라미터는
  // searchParams가 이미 풀어준다.
  const header = req.headers.get(TEACHER_HEADER);
  const code = header !== null ? decodeCode(header) : req.nextUrl.searchParams.get("t");

  if (!isTeacherCodeValid(code)) {
    return NextResponse.json({ error: "교사 접속 코드가 필요합니다." }, { status: 401 });
  }
  return null;
}
