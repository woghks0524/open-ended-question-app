// "생각을 키우는 교실" 서·논술형 문항자료(PDF) → 구글 시트 문항 등록 파이프라인 v2.
// 입력: extract_all.py가 만든 청크 JSON(문항별 원문 텍스트 + 그림 페이지 정보)
// - 단계형 문항 지원: 본문항(하위문항 포함)을 우선 배정하고, 슬롯이 남으면 단계형 문항을 앞에 배치
// - 그림 필요 여부 플래그(needsFigure) 추출 → 별도 그림 파이프라인에서 처리
// 실행: node --env-file=.env.local scripts/import-thinking-class.mjs <chunks.json> [--grade 4] [--from 11] [--to 67] [--out rows.json]
import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const chunksPath = args.find((a) => !a.startsWith("--"));
const opt = (name, dflt) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : dflt;
};
const GRADE = opt("grade", "4");
const FROM = parseInt(opt("from", "1"));
const TO = parseInt(opt("to", "9999"));
const OUT = opt("out", `./thinking-class-rows-g${GRADE}.json`);

if (!chunksPath) {
  console.error("사용법: node --env-file=.env.local scripts/import-thinking-class.mjs <chunks.json> [--grade 4] [--from N] [--to M] [--out f.json]");
  process.exit(1);
}

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (keys.length === 0) throw new Error("OPENAI_API_KEYS가 설정되지 않았습니다.");
const client = new OpenAI({ apiKey: keys[0] });

const chunks = JSON.parse(readFileSync(chunksPath, "utf-8")).filter((c) => c.no >= FROM && c.no <= TO);
console.log(`정규화 대상: ${chunks.length}개 문항 (${FROM}~${TO})`);

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    subject: { type: "string", description: "교과명 (국어/사회/도덕/수학/과학/음악/미술/체육/영어/통합 중 하나)" },
    unit: { type: "string", description: "평가 과제명(문항 제목, 번호 제외)" },
    question1: { type: "string" },
    question2: { type: "string" },
    question3: { type: "string" },
    correctanswer1: { type: "string" },
    correctanswer2: { type: "string" },
    correctanswer3: { type: "string" },
    feedbackinstruction: { type: "string", description: "채점 지침(루브릭 요약+1~4점 매핑)" },
    needsFigure: { type: "boolean", description: "문항 풀이에 그림·표·활동지 이미지가 반드시 필요한가" },
    figureNote: { type: "string", description: "필요한 그림·표가 무엇인지 한 줄 설명(없으면 빈 문자열)" },
  },
  required: ["subject", "unit", "question1", "question2", "question3", "correctanswer1", "correctanswer2", "correctanswer3", "feedbackinstruction", "needsFigure", "figureNote"],
};

const NORMALIZE_INSTRUCTIONS = `너는 초등 서·논술형 평가 자료를 웹앱 데이터로 변환하는 전문가야.
입력은 서울시교육청 "생각을 키우는 교실" 문항자료 PDF에서 추출한 한 문항의 원문 텍스트다.
(교수·학습 흐름도 / 문항 정보 / 서·논술형 문항 / 채점 기준·예시 답안 / 단계형 문항 섹션이 섞여 있음)

다음 규칙으로 JSON을 만들어라.

[문항 배정 — 슬롯 3개(question1~3)]
1. "서·논술형 평가 문항" 섹션의 본문항이 하위 문항 1), 2)로 나뉘면 각각 슬롯 하나씩 배정한다.
2. 슬롯이 남고 "단계형 문항" ①②가 있으면, 학습 순서대로 앞 슬롯에 단계형을, 마지막 슬롯에 본문항을 배치한다.
   (예: 단계형①→question1, 단계형②→question2, 본문항→question3. 단계형이 1개면 question1=단계형, question2=본문항)
3. 본문항(하위 포함)이 3개를 넘으면 본문항만으로 3슬롯을 채우고 단계형은 생략한다.
4. 각 question은 **그 문항만 읽어도 풀 수 있게** [상황]·제시문·조건을 문항 안에 포함시킨다(채점이 문항별 독립 수행되므로).
5. 괄호 채우기식 단계형 문항은 서술형으로 자연스럽게 바꾼다(예: "㉠에 알맞은 말을 쓰세요" → "…을 무엇이라고 하는지 쓰세요").

[★ 절대 금지 — 정답 유출]
이건 서술형 평가다. 문항이 답을 알려주면 평가가 성립하지 않는다. 다음을 엄격히 지켜라.
- **"예시 답안" 섹션의 문장을 question에 절대 넣지 마라.** correctanswer에만 넣는다.
- question에 "예를 들어, ~입니다" 형태로 **모범답안의 내용을 미리 서술하지 마라.**
  (나쁜 예: "민주주의의 뜻을 정의해 보세요. 예를 들어, 민주주의란 국민이 나라의 주인이 되어…"
   → 뒷문장이 곧 정답이므로 삭제하고 "민주주의의 뜻을 자신의 말로 정의해 보세요."로만 쓴다)
- 문항이 "N가지를 쓰시오"라고 요구하면, **그 N가지를 문항 안에 나열하지 마라.**
  (나쁜 예: "자석의 성질 세 가지를 모두 쓰고 … 자석의 성질은 A, B, C가 있습니다.")
- 원문 활동지의 **선택지 표(체크박스)는 선택지 그대로** 두고, "고르세요/체크하세요"로 묻는다.
  선택지를 본문에 풀어 쓴 뒤 "쓰시오"로 바꾸면 정답을 준 것이 된다.
- 판단 기준: question만 읽었을 때 학생이 **생각하지 않고 베끼기만 해도 정답이 되면 잘못된 것**이다.
- 단, 학생이 읽어야 할 **제시문·기사·자료 본문**은 정답이 아니므로 question에 포함시켜야 한다.
  (자료 = 판단 근거 → 포함 / 예시 답안 = 결론 → 제외)

[그림·표 판단]
- 문항이 그림·표·활동지 틀을 반드시 봐야 풀 수 있으면 needsFigure=true, figureNote에 무엇인지 쓴다.
- 그림 없이 텍스트만으로 완결되면 false.
- **표를 문항 텍스트로 풀어 쓸 때는 위 [절대 금지]를 먼저 지킨다.** 표가 자료(데이터·조건)면 풀어 써도 되지만,
  표가 답이 될 항목의 목록이면 풀어 쓰지 말고 needsFigure=true로 둔다.
- needsFigure=true인 경우에도 그림의 **맥락**(무엇에 대한 그림인지, 칸 구성·조건)은 문항에 요약해 넣는다.
  단 그림에서 읽어내야 할 **답 자체**는 넣지 않는다.

[모범답안]
- "예시 답안"(단계형 예시 답안 포함)에서 슬롯별로 correctanswer1~3에 배정한다.
- (학생 개별 경험) 같은 표시는 "예: ..." 형태의 구체적 예시로 자연스럽게 보완한다.

[채점 지침 feedbackinstruction]
- "채점 기준" 루브릭(평가요소별 능숙/보통/도움필요)을 요약해 넣는다.
- 점수 매핑을 반드시 이 척도로 통일한다: 능숙=4점, 보통=3점, 도움필요=2점, 무응답·문항과 무관=1점.
  (원문이 배점 합산식이어도 반드시 1~4점 척도로 변환할 것. 5점 이상이나 0점은 절대 쓰지 않는다.)
- 루브릭의 피드백 지도 방법이 있으면 "낮은 점수일 때 이렇게 안내"로 포함한다. 600자 이내.

[subject/unit]
- subject는 "문항 정보"의 교과 항목에서 가져온다. unit은 평가 과제명을 그대로(번호 제외).`;

async function normalize(chunk) {
  const resp = await client.responses.create({
    model: "gpt-4o",
    instructions: NORMALIZE_INSTRUCTIONS,
    input: `문항 ${chunk.no} 원문:\n\n${chunk.text}`,
    temperature: 0,
    text: { format: { type: "json_schema", name: "assessment_row", strict: true, schema: SCHEMA } },
  });
  return JSON.parse(resp.output_text);
}

// 과목 약칭 (문항 코드용)
const ABBR = { 국어: "국", 사회: "사", 도덕: "도", 수학: "수", 과학: "과", 음악: "음", 미술: "미", 체육: "체", 영어: "영", 통합: "통" };

// 동시 4개씩 정규화
const results = new Array(chunks.length);
let cursor = 0;
async function worker() {
  while (cursor < chunks.length) {
    const i = cursor++;
    const c = chunks[i];
    const t0 = Date.now();
    try {
      results[i] = { chunk: c, n: await normalize(c) };
      console.log(`✓ 문항 ${c.no} (${((Date.now() - t0) / 1000).toFixed(1)}s) ${c.title.slice(0, 24)}`);
    } catch (e) {
      results[i] = { chunk: c, error: String(e).slice(0, 120) };
      console.log(`✗ 문항 ${c.no} 실패: ${String(e).slice(0, 80)}`);
    }
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

// 코드 부여: 과목별 연번 (4학년만 예외 — 파일럿 국어 1~10이 국01~국10을 선점)
const counters = GRADE === "4" ? { 국: 10 } : {};
const rows = [];
for (const r of results) {
  if (!r || r.error) continue;
  const { chunk, n } = r;
  const abbr = ABBR[n.subject] || n.subject[0];
  counters[abbr] = (counters[abbr] || 0) + 1;
  const code = `생각교실${GRADE}${abbr}${String(counters[abbr]).padStart(2, "0")}`;
  rows.push({
    timestamp: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    settingname: code,
    question1: n.question1, question2: n.question2, question3: n.question3,
    image1: "", image2: "", image3: "",
    correctanswer1: n.correctanswer1, correctanswer2: n.correctanswer2, correctanswer3: n.correctanswer3,
    feedbackinstruction: n.feedbackinstruction,
    unitkey: `${n.subject}|${GRADE}|공통|생각을키우는교실|${n.unit}`,
    grade: GRADE, semester: "공통", subject: n.subject,
    publisher: "생각을키우는교실", unit: n.unit,
    vectorapi: "", sheeturl: "",
    _no: chunk.no, // 원본 문항 번호 (그림 파이프라인 연결용, 업로드 시 제거)
    _needsFigure: n.needsFigure,
    _figureNote: n.figureNote,
    _figurePages: chunk.figure_pages?.map((f) => f.page) || [],
  });
}

writeFileSync(OUT, JSON.stringify(rows, null, 1), "utf-8");
const failed = results.filter((r) => r?.error).map((r) => r.chunk.no);
console.log(`\n정규화 완료 ${rows.length}건 → ${OUT}` + (failed.length ? ` / 실패: ${failed.join(",")}` : ""));
console.log("그림 필요 플래그:", rows.filter((r) => r._needsFigure).map((r) => `${r._no}(${r.settingname})`).join(", ") || "없음");
