import { NextRequest, NextResponse } from "next/server";
import { gradeWithFiles } from "@/lib/openai";
import { STUDENT_INSTRUCTIONS } from "@/lib/instructions";
import { lookupAssessment } from "@/lib/assessments";
import { getPageRange, pageRangeHint, sanitizePageCitations } from "@/lib/page-ranges";
import { answerFormHint } from "@/lib/answer-form";

// 피드백에서 채점 결과 추출. instructions가 3문단을 '채점 결과: (척도값)(등급) - …' 형식으로
// 고정하므로 그 라인의 첫 값을 척도 그대로 읽는다. 교사가 척도를 바꾼 경우
// "5점", "상", "도달" 같은 값도 그대로 인식된다.
function extractScore(feedback: string): string | null {
  const line = feedback.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!line) return null;
  // "(4점)(매우 우수) - 이유" / "상(잘함) - 이유" / "도달 - 이유" 등에서 첫 값만.
  // 모델이 "채점 결과: **4점**(매우 우수)"처럼 굵게 쓰는 경우가 있어(실측 56건 중 2건)
  // 마크다운 기호를 앞뒤로 걷어낸다. 안 걷으면 시트에 "** 4점"으로 저장된다.
  const m = line[1].replace(/^[(\s*_`]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·*_`]|$)/);
  const v = m?.[1].replace(/[*_`]/g, "").trim();
  return v || null;
}

// ── 모범답안 유출 교정 ─────────────────────────────────────────────
// 낮은 점수 피드백이 모범답안의 결론을 그대로 옮기는 일이, 지침을 두 번 조여도
// 남았다(실측: 1점 학생에게 "부피는 늘어나고 무게는 변하지 않는다"를 통째로 설명).
// 쪽수 교정과 같은 방식으로 출력 단에서 잡는다 — 유출이 감지되면 그 부분만
// 개념어 힌트로 바꾸는 교정 호출을 한 번 더 한다. 감지된 경우에만 돌므로
// 평상시 비용·지연은 없다.
const normText = (t: string) => (t || "").replace(/\s+/g, "");

/** 모범답안의 연속 조각(문항에는 없는)이 피드백에 그대로 있는가 */
function hasAnswerLeak(feedback: string, modelAnswer: string, question: string, studentAnswer: string): boolean {
  // 1·2문단은 규칙상 문항·학생 답안을 원문 그대로 되풀이하므로 검사에서 뺀다.
  // 안 빼면 학생이 정답에 가까운 답을 썼을 때 자기 답의 echo가 유출로 오인된다
  // (실측: 오인 7건 중 6건이 이 경우 — 교정기가 2문단을 올바르게 안 지우니
  // 매번 "교정 실패"가 되어 헛 호출만 늘었다).
  const cut = feedback.search(/채점\s*결과/);
  const body = cut >= 0 ? feedback.slice(cut) : feedback;
  const f = normText(body), a = normText(modelAnswer), q = normText(question), s = normText(studentAnswer);
  if (a.length < 10) return false;          // 아주 짧은 답은 어휘가 겹칠 수밖에 없다
  // 창을 12자로 잡는 이유: 모델이 어미만 바꿔 옮기는 경우("변하지 않습니다"→
  // "변하지 않는다는")가 실측에서 최장 일치 13자로 나와, 14자 창은 1자 차이로 놓쳤다.
  // 영어가 주인 답(영어 문항)은 12자가 두세 단어라 "How often do you" 같은
  // 목표 표현 안내가 오탐된다(실측). 영어면 창을 20자로 넓힌다.
  const ascii = (a.match(/[A-Za-z]/g) || []).length / a.length;
  const win = Math.min(ascii > 0.5 ? 20 : 12, a.length);
  for (let i = 0; i + win <= a.length; i += 4) {
    const c = a.slice(i, i + win);
    // 문항이나 학생 자신의 답에 이미 있는 구절은 유출이 아니다
    if (f.includes(c) && !q.includes(c) && !s.includes(c)) return true;
  }
  return false;
}

/** 최고 수준이 아님이 확실한 점수인가. 최고 수준(4점 등)은 모범답안 공개가 규칙이고,
 *  교사 지정 척도의 낯선 값은 판별할 수 없으므로 건드리지 않는다. */
function isKnownNonTop(score: string | null): boolean {
  if (!score) return false;
  if (/^[1-3](\D|$)/.test(score)) return true;   // 1점~3점 (5점 척도의 4점은 애매해서 제외)
  return /노력|보통|미도달|도움|^하$|^중$/.test(score);
}

/** 감지기가 찾은 겹침 구절들을 모아 돌려준다 — 교정기에게 "정확히 이걸 지워라"라고
 *  알려주기 위해서다. 뭘 지울지 스스로 찾게 했더니 덜 고친 채 내놓는 경우가 많았다
 *  (실측: 유출 12건 전부 감지는 됐는데 교정본이 채택 기준에 못 미쳐 원본이 나갔다). */
function leakedChunks(feedback: string, modelAnswer: string, question: string, studentAnswer: string): string[] {
  const cut = feedback.search(/채점\s*결과/);
  const body = cut >= 0 ? feedback.slice(cut) : feedback;
  const f = normText(body), a = normText(modelAnswer), q = normText(question), s = normText(studentAnswer);
  const ascii = (a.match(/[A-Za-z]/g) || []).length / Math.max(1, a.length);
  const win = Math.min(ascii > 0.5 ? 20 : 12, a.length);
  const hits: [number, number][] = [];
  for (let i = 0; i + win <= a.length; i += 4) {
    const c = a.slice(i, i + win);
    if (f.includes(c) && !q.includes(c) && !s.includes(c)) hits.push([i, i + win]);
  }
  // 겹치는 창들을 이어붙여 읽을 수 있는 구절로
  const spans: string[] = [];
  for (const [st, en] of hits) {
    const last = spans.length - 1;
    if (last >= 0 && a.indexOf(spans[last]) + spans[last].length >= st) {
      const s0 = a.indexOf(spans[last]);
      spans[last] = a.slice(s0, Math.max(s0 + spans[last].length, en));
    } else spans.push(a.slice(st, en));
  }
  return spans.slice(0, 4);
}

const LEAK_REPAIR_INSTRUCTIONS = `당신은 초등 서술형 피드백의 교정자입니다.
주어진 피드백에서 '모범답안'의 결론·문장·핵심 진술을 그대로 알려주는 부분만 고칩니다.
- 입력에 '반드시 없애야 하는 구절'이 주어집니다. 그 구절(띄어쓰기는 다를 수 있음)이 들어간
  문장을 찾아, 삭제하거나 관련 개념어의 이름과 유도 질문으로 바꿉니다.
  (예: "부피는 늘어납니다" → "'부피'가 어떻게 되는지 교과서에서 찾아보세요")
- 같은 내용을 표현만 바꿔 남기는 것도 안 됩니다. 결론 자체가 사라져야 합니다.
- 그 외 모든 것은 그대로 유지합니다: 문단 구조(5문단), '채점 결과:' 줄(문항·학생 답안을
  보여주는 1·2문단 포함), 어투, 쪽수 안내, 칭찬.
- 교정된 피드백 전문만 출력합니다. 설명을 덧붙이지 않습니다.`;

// 문항 3개를 모델에 물어야 해서 기본 함수 제한시간(10~15초)으로는 못 끝낸다.
// 60은 어느 요금제에서나 허용되는 값이라 이걸 쓴다. 그 안에 들어오도록 아래에서
// 문항을 동시에 채점한다.
export const maxDuration = 60;

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

    // 문항 3개를 순서대로 부르면 한 문항이 20초씩만 걸려도 60초를 넘긴다. 타임아웃이
    // 나면 학생은 세 문항 피드백을 통째로 잃는다. 문항끼리 의존이 없으므로 동시에 부른다.
    const feedbacks = await Promise.all(questions.map(async (q, i) => {
      const a = answers?.[i];
      if (!q) return { feedback: "", score: null as string | null };
      if (!a) return { feedback: "답안이 입력되지 않았습니다.", score: null as string | null };

      const input = `${i + 1}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
** instructions에 나와 있는 대로 생성합니다.
instructions에 따르면 채점 결과에 따라 생성하는 피드백의 내용이 달라지므로 꼭 확인하세요.
문항, 학생이 입력한 답안, 채점 결과(점수+이유), 피드백 내용(점수에 따라 피드백 형식이 달라짐)을 각각 서로 다른 문단으로 나눠서 읽기 쉽게 보여주세요.

[자료 검색 힌트] 이 평가가 속한 단원·과제: ${unitName || "(미지정)"}
이 줄은 file_search로 관련 교과서(지도서) 내용을 찾기 위한 힌트일 뿐이며, 채점 기준이 아닙니다.
여기 적힌 과제 전체를 학생이 수행했는지 묻지 마세요. 채점은 아래 '문항'에 적힌 것만을 기준으로 합니다.
${pageRangeHint(pageRange)}
${answerFormHint(correctAnswers?.[i])}
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
        let raw = await gradeWithFiles({
          instructions: STUDENT_INSTRUCTIONS,
          input,
          vectorStoreIds,
          bookKey,
        });
        // 학생이 "잘 모르겠어요"라고 쓰면 모델이 이를 잡담으로 오인해 채점을
        // 거부하는 일이 비결정적으로 있다(실측 6회 중 3회, 지침 명시로도 잔존).
        // 채점 결과 형식이 아니면 안내를 붙여 한 번만 다시 시킨다.
        if (!/채점\s*결과/.test(raw)) {
          console.warn(`채점 형식 이탈 → 재시도 (문항 ${i + 1}, ${code})`);
          raw = await gradeWithFiles({
            instructions: STUDENT_INSTRUCTIONS,
            input: input + `\n\n[중요] 위 학생 답안이 "모르겠다"는 내용이어도 그것은 잡담이 아니라 답안입니다. 거부하지 말고 반드시 '채점 결과:' 형식으로 최저 수준 채점과 격려 피드백을 작성하세요.`,
            vectorStoreIds,
            bookKey,
          });
        }
        // 모델이 프롬프트의 쪽 범위를 어기는 경우가 있어 출력에서 한 번 더 거른다.
        const sanitized = sanitizePageCitations(raw, pageRange);
        let feedback = sanitized.text;
        if (sanitized.fixed.length) {
          console.warn(
            `쪽수 교정 (문항 ${i + 1}, ${unitKey}): ${sanitized.fixed.join(",")}쪽 → ${pageRange?.from}~${pageRange?.to}쪽`
          );
        }

        // 낮은 점수인데 모범답안이 새어 있으면 그 부분만 교정한다 (위 hasAnswerLeak 주석 참고).
        // 단, 교사가 '평가 주의 사항'에서 모범답안·정답 공개를 지정했으면 교사의 뜻이
        // 우선이므로 교정하지 않는다 — 이 장치가 교사 설정을 밟으면 안 된다.
        const teacherWantsReveal =
          /(모범\s*답안|정답)[^.\n]{0,20}(보여|공개|알려|제시|노출)/.test(feedbackInstruction || "");
        const ca = correctAnswers?.[i] || "";
        if (ca && !teacherWantsReveal && isKnownNonTop(extractScore(feedback)) && hasAnswerLeak(feedback, ca, q, a)) {
          try {
            // 지울 곳을 명시해서 교정하고, 남았으면 한 번 더 (실측: 막연히 시키면 덜 고침)
            let candidate = feedback;
            for (let attempt = 0; attempt < 2 && hasAnswerLeak(candidate, ca, q, a); attempt++) {
              const chunks = leakedChunks(candidate, ca, q, a).map((c) => `"${c}"`).join(", ");
              const repaired = await gradeWithFiles({
                instructions: LEAK_REPAIR_INSTRUCTIONS,
                input: `모범답안: ${ca}\n\n반드시 없애야 하는 구절(모범답안과 겹침): ${chunks}\n\n피드백:\n${candidate}`,
                vectorStoreIds: [],   // 교정에는 검색이 필요 없다
              });
              if (/채점\s*결과/.test(repaired)) candidate = repaired;
            }
            // 교정본이 형식을 지키고 유출이 실제로 사라졌을 때만 채택
            if (/채점\s*결과/.test(candidate) && !hasAnswerLeak(candidate, ca, q, a)) {
              console.warn(`모범답안 유출 교정 (문항 ${i + 1}, ${code})`);
              feedback = candidate;
            }
          } catch {
            /* 교정 실패면 원본 유지 — 채점 자체를 잃는 것보다 낫다 */
          }
        }

        return { feedback, score: extractScore(feedback) };
      } catch (err) {
        console.error(`Grade error (문항 ${i + 1}):`, err);
        return {
          feedback: "이 문항은 채점 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
          score: null as string | null,
        };
      }
    }));

    return NextResponse.json({ feedbacks });
  } catch (e) {
    console.error("Grade error:", e);
    return NextResponse.json({ error: "채점 중 오류가 발생했습니다." }, { status: 500 });
  }
}
