import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";
import { toFile } from "openai";

// POST(multipart): 교사가 이 평가에만 쓸 추가 자료를 업로드한다.
// - 단원 라이브러리는 공유/읽기전용이라 복사하지 않는다.
// - 평가별 전용 벡터스토어(개인 보관함)를 만들어 파일을 올리고, 단원 key로 태그한다.
//   → 채점 시 [라이브러리, 이 보관함]을 key 필터로 함께 검색해도 이 평가 파일만 잡힌다.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const unitKey = (form.get("unitKey") as string) || "";
    let vectorStoreId = (form.get("vectorStoreId") as string) || "";
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
