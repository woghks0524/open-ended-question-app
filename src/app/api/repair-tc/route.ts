// [임시] 생각교실 '자료 없는 문항' 수정안을 시트에 반영하는 1회용 라우트.
// 반영 확인 후 이 파일과 src/data/thinking-class-repairs.json 을 삭제한다.
//
// 안전장치: 인증 없는 학생용 앱이므로 임의 입력을 받지 않는다. 수정 내용은 배포된
// JSON에 고정돼 있고, 랜덤 토큰이 맞을 때만 동작한다. GET은 미리보기(쓰기 없음).
//
// 주의: 폴더 이름을 밑줄로 시작하면(_repair) Next.js가 private folder로 보고
// 라우팅에서 제외한다. 반드시 밑줄 없이 둘 것.
import { NextRequest, NextResponse } from "next/server";
import { updateAssessmentFields } from "@/lib/google-sheets";
import REPAIRS from "@/data/thinking-class-repairs.json";

const TOKEN = "Kx7pR2mQvN8sT4wZ9bH3jY6cL1dF5gA0";

type Repair = { code: string; field: string; value: string; why: string };
const list = REPAIRS as unknown as Repair[];

const guard = (req: NextRequest) => req.nextUrl.searchParams.get("token") === TOKEN;

export async function GET(req: NextRequest) {
  if (!guard(req)) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    count: list.length,
    items: list.map((r) => ({ code: r.code, field: r.field, why: r.why, len: r.value.length })),
  });
}

export async function POST(req: NextRequest) {
  if (!guard(req)) return NextResponse.json({ error: "not found" }, { status: 404 });
  try {
    const result = await updateAssessmentFields(
      list.map((r) => ({ code: r.code, field: r.field, value: r.value }))
    );
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
