import { NextRequest, NextResponse } from "next/server";
import { getOpenAIClient } from "@/lib/openai";

// POST: 벡터스토어 생성 및 기존 파일 복사, 또는 추가 파일 업로드
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action } = body;
    const client = getOpenAIClient();

    if (action === "create") {
      // 새 벡터스토어 생성 + Assistant 복제 + 기존 파일 복사
      const { settingName, teacherAssistantId, studentAssistantId, defaultVectorStoreId } = body;

      // 1. 새 벡터스토어 생성
      const newVectorStore = await client.vectorStores.create({ name: "새 벡터 스토어" });

      // 2. 교사용 Assistant 복제
      const baseTeacher = await client.beta.assistants.retrieve(teacherAssistantId);
      const newTeacher = await client.beta.assistants.create({
        name: `${settingName}_teacher`,
        instructions: baseTeacher.instructions || "",
        tools: baseTeacher.tools || [],
        model: baseTeacher.model,
        tool_resources: { file_search: { vector_store_ids: [newVectorStore.id] } },
      });

      // 3. 학생용 Assistant 복제
      const baseStudent = await client.beta.assistants.retrieve(studentAssistantId);
      const newStudent = await client.beta.assistants.create({
        name: `${settingName}_student`,
        instructions: baseStudent.instructions || "",
        tools: baseStudent.tools || [],
        model: baseStudent.model,
        tool_resources: { file_search: { vector_store_ids: [newVectorStore.id] } },
      });

      // 4. 기존 벡터스토어에서 파일 복사
      const sourceFiles = await client.vectorStores.files.list(defaultVectorStoreId);
      if (sourceFiles.data) {
        for (const file of sourceFiles.data) {
          await client.vectorStores.files.create(newVectorStore.id, {
            file_id: file.id,
          });
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      return NextResponse.json({
        vectorStoreId: newVectorStore.id,
        teacherAssistantId: newTeacher.id,
        studentAssistantId: newStudent.id,
      });
    }

    if (action === "upload") {
      // 추가 파일 업로드
      const { vectorStoreId } = body;
      // 파일은 FormData로 별도 처리 필요 - 여기서는 file_id 기반
      const { fileId } = body;

      await client.vectorStores.files.create(vectorStoreId, {
        file_id: fileId,
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("Vectorstore error:", e);
    return NextResponse.json({ error: "벡터스토어 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
