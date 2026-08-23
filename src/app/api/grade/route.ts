import { NextRequest, NextResponse } from "next/server";
import { gradeWithFiles } from "@/lib/openai";
import { STUDENT_INSTRUCTIONS } from "@/lib/instructions";
import { lookupAssessment } from "@/lib/google-sheets";
import { getPageRange, pageRangeHint, sanitizePageCitations } from "@/lib/page-ranges";

// 피드백에서 채점 결과 추출. instructions가 3문단을 '채점 결과: (척도값)(등급) - …' 형식으로
// 고정하므로 그 라인의 첫 값을 척도 그대로 읽는다. 교사가 척도를 바꾼 경우
// "5점", "상", "도달" 같은 값도 그대로 인식된다.
function extractScore(feedback: string): string | null {
  const line = feedback.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!line) return null;
  // "(4점)(매우 우수) - 이유" / "상(잘함) - 이유" / "도달 - 이유" 등에서 첫 값만
  const m = line[1].replace(/^[(\s]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·]|$)/);
  const v = m?.[1].trim();
  return v || null;
}

// POST: AI 채점 및 피드백 생성 (학생용 4단계)
// Responses API + file_search 사용. 문항마다 독립 호출이라 동시 채점이 섞이지 않음.
// 보안: 클라이언트는 평가 코드와 학생 답안만 보낸다. 문항·모범답안·채점지침·단원 정보는
// 서버가 시트에서 직접 조회한다 (모범답안 등이 학생 브라우저에 노출되지 않도록).
export async function POST(req: NextRequest) {
  try {
    const { code, answers } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "평가 코드가 필요합니다." }, { status: 400 });
    }

    const assessment = await lookupAssessment(code);
    if (!assessment) {
      return NextResponse.json({ error: "평가 코드를 다시 확인해주세요." }, { status: 404 });
    }

    const questions = [assessment.question1, assessment.question2, assessment.question3];
    const correctAnswers = [assessment.correctanswer1, assessment.correctanswer2, assessment.correctanswer3];
    const feedbackInstruction = assessment.feedbackinstruction;
    const unitKey = assessment.unitkey;
    const extraVectorStoreId = assessment.vectorapi;

    // unitKey = "과목|학년|학기|출판사|단원" → 교과서 단위(bookKey)로 검색 좁히고 단원명은 프롬프트로
    const parts = (unitKey || "").split("|");
    const bookKey = parts.slice(0, 4).join("|");
    const unitName = parts.slice(4).join("|");

    // 공용 지도서 라이브러리 + (있으면) 이 평가 전용 교사 보관함
    const vectorStoreIds = [process.env.LIBRARY_VECTORSTORE_ID, extraVectorStoreId];

    // 이 단원의 학생 교과서 쪽 범위. 벡터스토어 텍스트엔 쪽 정보가 없어서 모델이 쪽수를
    // 지어내는 문제가 있었다(지도서 자체 쪽번호 222를 교과서 쪽으로 인용). 프롬프트로
    // 범위를 알려주고, 출력에서 한 번 더 검증한다.
    const pageRange = getPageRange(unitKey);

    const feedbacks: { feedback: string; score: string | null }[] = [];

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const a = answers?.[i];
      if (!q) {
        feedbacks.push({ feedback: "", score: null });
        continue;
      }
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
${pageRangeHint(pageRange)}
평가 주의 사항: ${feedbackInstruction || "(없음)"}${
        correctAnswers?.[i]
          ? `
교사가 등록한 모범답안(채점 기준으로 참고하되, instructions의 수준별 피드백 규칙을 따를 것 — 최고 수준이 아닐 때는 모범답안 전체를 그대로 노출하지 않기): ${correctAnswers[i]}`
          : ""
      }
문항: ${q}
학생 답안: ${a}`;

      // 문항별 독립 처리: 한 문항이 실패해도 나머지 문항 채점은 계속되도록 함
      try {
        const raw = await gradeWithFiles({
          instructions: STUDENT_INSTRUCTIONS,
          input,
          vectorStoreIds,
          bookKey,
        });
        // 모델이 프롬프트의 쪽 범위를 어기는 경우가 있어 출력에서 한 번 더 거른다.
        const { text: feedback, fixed } = sanitizePageCitations(raw, pageRange);
        if (fixed.length) {
          console.warn(
            `쪽수 교정 (문항 ${i + 1}, ${unitKey}): ${fixed.join(",")}쪽 → ${pageRange?.from}~${pageRange?.to}쪽`
          );
        }
        feedbacks.push({ feedback, score: extractScore(feedback) });
      } catch (err) {
        console.error(`Grade error (문항 ${i + 1}):`, err);
        feedbacks.push({
          feedback: "이 문항은 채점 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          score: null,
        });
      }
    }

    return NextResponse.json({ feedbacks });
  } catch (e) {
    console.error("Grade error:", e);
    return NextResponse.json({ error: "채점 중 오류가 발생했습니다." }, { status: 500 });
  }
}
