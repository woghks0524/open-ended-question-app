import { NextRequest, NextResponse } from "next/server";
import { gradeWithFiles } from "@/lib/openai";
import { STUDENT_INSTRUCTIONS } from "@/lib/instructions";

// POST: AI 채점 및 피드백 생성 (학생용 4단계)
// Responses API + file_search 사용. 문항마다 독립 호출이라 동시 채점이 섞이지 않음.
export async function POST(req: NextRequest) {
  try {
    const { questions, answers, feedbackInstruction, vectorStoreId } = await req.json();

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

평가 주의 사항: ${feedbackInstruction || "(없음)"}
문항: ${q}
학생 답안: ${a}`;

      const feedback = await gradeWithFiles({
        instructions: STUDENT_INSTRUCTIONS,
        input,
        vectorStoreId,
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
