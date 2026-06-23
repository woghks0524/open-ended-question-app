import { NextRequest, NextResponse } from "next/server";
import { gradeWithFiles } from "@/lib/openai";
import { TEACHER_INSTRUCTIONS } from "@/lib/instructions";

// POST: AI로 평가 내용 확인 (교사용 6단계)
// Responses API + file_search 사용.
export async function POST(req: NextRequest) {
  try {
    const { questions, correctAnswers, feedbackInstruction, unitKey, extraVectorStoreId } = await req.json();
    const parts = (unitKey || "").split("|");
    const bookKey = parts.slice(0, 4).join("|");
    const unitName = parts.slice(4).join("|");
    const vectorStoreIds = [process.env.LIBRARY_VECTORSTORE_ID, extraVectorStoreId];

    // 문항 및 모범 답안 등록 메시지
    let input = "평가 문항 및 모범 답안 등록:\n";
    for (let i = 0; i < questions.length; i++) {
      if (questions[i]) {
        input += `${i + 1}번 문항: ${questions[i]}\n`;
        input += `${i + 1}번 모범 답안: ${correctAnswers[i] || ""}\n`;
      }
    }
    input += `\n- 출처는 【5:12†source】와 같은 참조는 보이지 않도록 합니다.`;
    input += `\n- ***[교과서 18쪽]과 같이 참고한 파일과 페이지 수로 나타냅니다.`;
    input += `\n- 모범 답안은 파일에서 직접적으로 확인할 수 없는 경우에도 Assistant의 지식을 바탕으로 생성하되, 파일 내용과 상반되지 않도록 한다.`;
    input += `\n- 답안이 비워지거나 생략되지 않도록 한다.`;

    if (feedbackInstruction) {
      input += `\n\n평가 주의 사항: ${feedbackInstruction}`;
    }

    input += `\n\n이 평가의 단원: ${unitName || "(미지정)"} — file_search로 이 단원과 관련된 교과서(지도서) 내용을 찾아 그 내용·예시를 근거로 하세요.`;
    input += `\n\n입력한 평가 정보를 모두 요약해서 보여줘. 입력한 문항에 대해서만 보여줘. 파일에서 모범 답안이 필요한 경우, 벡터스토어를 사용해서 생성해줘. 1번 문항: ~ 보여주고, 문단 바꿔서 1번 모범 답안: ~ 해서 보여줘.`;

    const result = await gradeWithFiles({
      instructions: TEACHER_INSTRUCTIONS,
      input,
      vectorStoreIds,
      bookKey,
    });

    return NextResponse.json({ result });
  } catch (e) {
    console.error("Verify error:", e);
    return NextResponse.json({ error: "확인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
