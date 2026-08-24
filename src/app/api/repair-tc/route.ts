// [임시] 생각교실 문항의 '정답 유출' 수정안을 시트에 반영하는 1회용 라우트.
// 반영 확인 후 이 파일과 src/data/thinking-class-repairs.json 을 삭제한다.
//
// 왜 필요한가: 로컬에는 GCP_CREDENTIALS가 없고(Vercel 환경변수가 전부 Sensitive),
// /api/assessment 의 POST는 addRow만 지원해 기존 행을 고칠 수 없다.
//
// 안전장치: 인증 없는 학생용 앱이므로 임의 입력을 받지 않는다. 수정 내용은 배포된
// JSON에 고정돼 있고, 랜덤 토큰이 맞을 때만 동작한다. GET은 미리보기(쓰기 없음).
import { NextRequest, NextResponse } from "next/server";
import { updateAssessmentFields } from "@/lib/google-sheets";
import REPAIRS from "@/data/thinking-class-repairs.json";

const TOKEN = "mZcdd338pdCOnAk6mQuXFETqcP7pULBB";

type Repair = { code: string; slot: number; before: string; after: string };
const list = REPAIRS as unknown as Repair[];

function guard(req: NextRequest) {
  return req.nextUrl.searchParams.get("token") === TOKEN;
}

// 미리보기 — 무엇을 바꿀 것인지만 반환
export async function GET(req: NextRequest) {
  if (!guard(req)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    count: list.length,
    items: list.map((r) => ({
      code: r.code, field: `question${r.slot}`,
      beforeLen: r.before.length, afterLen: r.after.length,
      preview: r.after.slice(0, 60),
    })),
  });
}

// 실제 반영
export async function POST(req: NextRequest) {
  if (!guard(req)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const updates = list.map((r) => ({
      code: r.code, field: `question${r.slot}`, value: r.after,
    }));
    const result = await updateAssessmentFields(updates);
    const tally = result.reduce<Record<string, number>>((a, r) => {
      a[r.status] = (a[r.status] || 0) + 1;
      return a;
    }, {});
    return NextResponse.json({ tally, result });
  } catch (e) {
    console.error("repair error:", e);
    return NextResponse.json({ error: String(e).slice(0, 300) }, { status: 500 });
  }
}
