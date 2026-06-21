import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

// POST: 벡터스토어 생성(기본 교과서 자료 복사) 또는 추가 파일 업로드
// Assistant 복제는 더 이상 하지 않는다(폐기 대상). 채점은 Responses API가 vectorStoreId로 직접 수행.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const client = getOpenAIClient();

    if (action === "create") {
      // 새 벡터스토어 생성 + 기본(교과서) 벡터스토어 파일 복사
      const { settingName, defaultVectorStoreId } = body;

      const newVectorStore = await client.vectorStores.create({
        name: settingName ? `${settingName}_vs` : "새 벡터 스토어",
      });

      // 선택한 교과서의 기본 자료를 새 벡터스토어로 복사
      if (defaultVectorStoreId) {
        const sourceFiles = await client.vectorStores.files.list(defaultVectorStoreId);
        for (const file of sourceFiles.data || []) {
          await client.vectorStores.files.create(newVectorStore.id, { file_id: file.id });
          await new Promise((r) => setTimeout(r, 500));
        }
      }

      return NextResponse.json({ vectorStoreId: newVectorStore.id });
    }

    if (action === "upload") {
      // 추가 파일 업로드(file_id 기반)
      const { vectorStoreId, fileId } = body;
      await client.vectorStores.files.create(vectorStoreId, { file_id: fileId });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Vectorstore error:", e);
    return NextResponse.json({ error: "벡터스토어 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
