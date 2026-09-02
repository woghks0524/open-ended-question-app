import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { toFile } from "openai";
import { requireTeacher } from "@/lib/teacher-auth";

// POST(multipart): 교사가 이 평가에만 쓸 추가 자료를 업로드한다.
// - 단원 라이브러리는 공유/읽기전용이라 복사하지 않는다.
// - 평가별 전용 벡터스토어(개인 보관함)를 만들어 파일을 올리고, 단원 key로 태그한다.
//   → 채점 시 [라이브러리, 이 보관함]을 key 필터로 함께 검색해도 이 평가 파일만 잡힌다.
// 교사만: OpenAI 벡터스토어 생성·파일 적재라 호출마다 비용이 나간다.
export async function POST(req: NextRequest) {
  const denied = requireTeacher(req);
  if (denied) return denied;

  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const unitKey = (form.get("unitKey") as string) || "";
    let vectorStoreId = (form.get("vectorStoreId") as string) || "";
    // '기존 문항 가져오기'로 온 원본 보관함. 여기엔 절대 쓰지 않는다 — 원본 문항의
    // 채점 자료가 바뀐다. 대신 사본 보관함을 만들고 원본의 파일 참조를 복사해 온다.
    // (OpenAI 파일은 공유 객체라 file_id를 다른 스토어에 붙이는 건 저장 비용이 없다)
    const copyFrom = (form.get("copyFrom") as string) || "";
    const settingName = (form.get("settingName") as string) || "";

    if (!file) {
      return NextResponse.json({ error: "파일이 없습니다." }, { status: 400 });
    }

    const client = getOpenAIClient();

    // 평가 전용 벡터스토어가 아직 없으면 생성
    if (!vectorStoreId) {
      const vs = await client.vectorStores.create({
        name: settingName ? `${settingName}_교사자료` : "교사 추가 자료",
      });
      vectorStoreId = vs.id;

      if (copyFrom) {
        try {
          // 원본 보관함의 파일들을 새 보관함에도 연결 (attributes 유지)
          for await (const f of client.vectorStores.files.list(copyFrom)) {
            await client.vectorStores.files.create(vectorStoreId, {
              file_id: f.id,
              ...(f.attributes ? { attributes: f.attributes } : {}),
            });
          }
        } catch (e) {
          // 원본 복사가 실패해도 새 파일 업로드는 계속한다 (원본 자료만 빠질 뿐)
          console.warn("원본 보관함 복사 실패:", String(e).slice(0, 120));
        }
      }
    }

    // 파일 업로드 후 교과서 단위(bookKey)로 태그 → 채점 시 라이브러리와 같은 필터에 함께 잡힘
    const bookKey = unitKey.split("|").slice(0, 4).join("|");
    const buffer = Buffer.from(await file.arrayBuffer());
    const uploaded = await client.files.create({
      file: await toFile(buffer, file.name),
      purpose: "assistants",
    });
    await client.vectorStores.files.create(vectorStoreId, {
      file_id: uploaded.id,
      attributes: { bookKey, source: "teacher", filename: file.name },
    });

    return NextResponse.json({ vectorStoreId });
  } catch (e) {
    console.error("Vectorstore error:", e);
    return NextResponse.json({ error: "추가 자료 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
