import { NextRequest, NextResponse } from "next/server";
import { createThread, runAssistantAndWait } from "@/lib/openai";

// POST: AI로 평가 내용 확인 (교사용 6단계)
export async function POST(req: NextRequest) {
  try {
    const { questions, correctAnswers, feedbackInstruction, assistantId } = await req.json();

    const threadId = await createThread();

    // 문항 및 모범 답안 등록 메시지
    let content = "평가 문항 및 모범 답안 등록:\n";
    for (let i = 0; i < questions.length; i++) {
      if (questions[i]) {
        content += `${i + 1}번 문항: ${questions[i]}\n`;
        content += `${i + 1}번 모범 답안: ${correctAnswers[i] || ""}\n`;
      }
    }
    content += `\n- 출처는 【5:12†source】와 같은 참조는 보이지 않도록 합니다.`;
    content += `\n- ***[교과서 18쪽]과 같이 참고한 파일과 페이지 수로 나타냅니다.`;
    content += `\n- 모범 답안은 파일에서 직접적으로 확인할 수 없는 경우에도 Assistant의 지식을 바탕으로 생성하되, 파일 내용과 상반되지 않도록 한다.`;
    content += `\n- 답안이 비워지거나 생략되지 않도록 한다.`;

    // 첫 번째 메시지 전송 (문항/답안)
    const { getOpenAIClient } = await import("@/lib/openai");
    const client = getOpenAIClient();

    await client.beta.threads.messages.create(threadId, {
      role: "user",
      content,
    });

    // 두 번째 메시지 (평가 주의 사항)
    if (feedbackInstruction) {
      await client.beta.threads.messages.create(threadId, {
        role: "user",
        content: `평가 주의 사항: ${feedbackInstruction}`,
      });
    }

    // 세 번째 메시지 (요약 요청)
    const result = await runAssistantAndWait(
      threadId,
      assistantId,
      "입력한 평가 정보를 모두 요약해서 보여줘. 입력한 문항에 대해서만 보여줘. 파일에서 모범 답안이 필요한 경우, 벡터스토어를 사용해서 생성해줘. 1번 문항: ~ 보여주고, 문단 바꿔서 1번 모범 답안: ~ 해서 보여줘."
    );

    return NextResponse.json({ result, threadId });
  } catch (e) {
    console.error("Verify error:", e);
    return NextResponse.json({ error: "확인 중 오류가 발생했습니다." }, { status: 500 });
  }
}
