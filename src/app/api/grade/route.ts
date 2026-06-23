import { NextRequest, NextResponse } from "next/server";
import { gradeWithFiles } from "@/lib/openai";
import { STUDENT_INSTRUCTIONS } from "@/lib/instructions";

// POST: AI 채점 및 피드백 생성 (학생용 4단계)
// Responses API + file_search 사용. 문항마다 독립 호출이라 동시 채점이 섞이지 않음.
export async function POST(req: NextRequest) {
  try {
    // unitKey: 선택한 단원, extraVectorStoreId: (선택) 이 평가의 교사 업로드 보관함
    const { questions, answers, feedbackInstruction, unitKey, extraVectorStoreId } = await req.json();

    // unitKey = "과목|학년|학기|출판사|단원" → 교과서 단위(bookKey)로 검색 좁히고 단원명은 프롬프트로
    const parts = (unitKey || "").split("|");
    const bookKey = parts.slice(0, 4).join("|");
    const unitName = parts.slice(4).join("|");

    // 공용 지도서 라이브러리 + (있으면) 이 평가 전용 교사 보관함
    const vectorStoreIds = [process.env.LIBRARY_VECTORSTORE_ID, extraVectorStoreId];

    const feedbacks: { feedback: string; score: number | null }[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers[i];
      if (!a) {
        feedbacks.push({ feedback: "답안이 입력되지 않았습니다.", score: null });
        continue;
      }

      const input = `${i + 1}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
** instructions에 나와 있는 대로 생성합니다.
instructions에 따르면 채점 결과에 따라 생성하는 피드백의 내용이 달라지므로 꼭 확인하세요.
문항, 학생이 입력한 답안, 채점 결과(점수+이유), 피드백 내용(점수에 따라 피드백 형식이 달라짐)을 각각 서로 다른 문단으로 나눠서 읽기 쉽게 보여주세요.

이 평가의 단원: ${unitName || "(미지정)"} — file_search로 이 단원과 관련된 교과서(지도서) 내용을 찾아 그 내용·예시를 근거로 채점하세요.
평가 주의 사항: ${feedbackInstruction || "(없음)"}
문항: ${q}
학생 답안: ${a}`;

      const feedback = await gradeWithFiles({
        instructions: STUDENT_INSTRUCTIONS,
        input,
        vectorStoreIds,
        bookKey,
      });

      // 점수 추출
      const scoreMatch = feedback.match(/(\d+)\s*점/);
      const score = scoreMatch ? parseInt(scoreMatch[1]) : null;

      feedbacks.push({ feedback, score });
    }

    return NextResponse.json({ feedbacks });
  } catch (e) {
    console.error("Grade error:", e);
    return NextResponse.json({ error: "채점 중 오류가 발생했습니다." }, { status: 500 });
  }
}
