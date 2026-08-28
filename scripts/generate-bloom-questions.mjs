// Bloom 6단계 균형 문항 자동 생성 — 4학년 사회 (단원 간·교과 간 융합 포함)
//
// 소스: 재환님이 단원별로 분리해 둔 지도서 PDF에서 추출한 텍스트
//       (00 분리_결과 — 추출은 별도 python 단계, scratchpad/bloom-src/*.txt)
// 스타일: 생각교실 4학년 사회 문항을 예시로 넣는다 — 수행 상황 프레임,
//       단계형 소문항, 조건 명시("6문장 이상"), 요소·개수 명시 루브릭.
// 원칙 (이 앱에서 실측으로 배운 것들):
//   · 문항은 텍스트만으로 완결 — 그림·표·외부 자료 참조 금지 (생각교실 변환 때
//     '자료 없는 문항'으로 데였다). 필요한 정보는 문항 안에 글로 담는다.
//   · 모범답안은 문항이 요구하는 요소를 전부 담는다 (결함 33건의 교훈).
//   · unitkey는 생각교실 관례를 따라 교과서와 매칭시키지 않는다 → 루브릭 채점.
//     융합 문항은 애초에 한 교과서에 못 묶이므로 이게 자연스럽다.
//   · 생성 즉시 검증: 모범답안 그대로 → 만점, 오답 → 낮은 점수. 못 넘으면 표시.
//
// 실행: node scripts/generate-bloom-questions.mjs [--only 코드]
// 산출: scratchpad/bloom-questions.json + bloom-questions-review.md (검토용)
//       ※ DB 등록은 하지 않는다 — 검토 후 별도 단계.

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const SCRATCH = process.env.BLOOM_DIR ||
  "/tmp/claude-501/-Users-jawoon-dev-open-ended-question-app/abe92b39-cf9f-4ae6-a61b-934f35f2318f/scratchpad";
const KEYS = process.env.OPENAI_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
const clients = KEYS.map((k) => new OpenAI({ apiKey: k }));
let cur = 0; const next = () => clients[cur++ % clients.length];
const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;

const src = (name) => readFileSync(`${SCRATCH}/bloom-src/${name}.txt`, "utf-8");
// 지도서 단원 텍스트는 8~11만 자라 그대로 못 넣는다. 앞(목차·개관·성취기준)과
// 본문 중간(주요 차시 활동)을 함께 잘라 20k자로 준다.
const excerpt = (t) => t.slice(0, 12000) + "\n…(중략)…\n" + t.slice(Math.floor(t.length * 0.4), Math.floor(t.length * 0.4) + 8000);

// ── 계획: Bloom 6수준 × 2문항, 융합 4문항 포함 ─────────────────────
const PLAN = [
  { code: "블룸4사01", bloom: "기억", units: ["사회42_1_민주주의와자치"], fusion: null,
    focus: "민주주의·자치의 기본 용어와 사례를 떠올려 쓰기 (예: 민주주의, 자치, 투표, 대표)" },
  { code: "블룸4사02", bloom: "기억", units: ["사회42_3_다양한환경과삶"], fusion: null,
    focus: "다양한 자연환경(사막·극지방·열대 등)의 이름과 특징을 떠올려 쓰기" },
  { code: "블룸4사03", bloom: "이해", units: ["사회42_1_민주주의와자치"], fusion: null,
    focus: "학교 자치(학급회의·전교 어린이회)가 왜 민주주의의 연습인지 자기 말로 설명" },
  { code: "블룸4사04", bloom: "이해", units: ["사회42_2_지역문제해결"], fusion: null,
    focus: "지역문제가 생기는 까닭과 해결 과정(문제 확인→원인→방안→실천)을 자기 말로 설명" },
  { code: "블룸4사05", bloom: "적용", units: ["사회42_2_지역문제해결"], fusion: null,
    focus: "배운 해결 절차를 우리 동네의 실제 문제 하나에 적용해 계획 세우기" },
  { code: "블룸4사06", bloom: "적용", units: ["사회42_3_다양한환경과삶"], fusion: null,
    focus: "환경에 따른 생활 모습 원리를 새로운 가상의 지역(문항 안에 조건 제시)에 적용" },
  { code: "블룸4사07", bloom: "분석", units: ["사회42_1_민주주의와자치"], fusion: null,
    focus: "두 가지 의사결정 방식(다수결 vs 대화와 타협)을 비교·분석 — 각각의 장단점과 알맞은 상황" },
  { code: "블룸4사08", bloom: "분석", units: ["사회41_3_경제활동과교류", "사회42_3_다양한환경과삶"], fusion: "단원 간",
    focus: "환경이 다른 두 지역(문항 안에 특산물·환경 조건 제시)이 왜 교류하게 되는지 원인-결과 분석 (1학기 경제·교류 × 2학기 환경)" },
  { code: "블룸4사09", bloom: "평가", units: ["사회42_2_지역문제해결"], fusion: null,
    focus: "지역문제의 해결 방안 두 가지(문항 안에 제시)를 기준을 세워 평가하고 더 나은 쪽을 근거와 함께 판단" },
  { code: "블룸4사10", bloom: "평가", units: ["사회42_1_민주주의와자치", "사회42_2_지역문제해결"], fusion: "단원 간",
    focus: "지역문제 해결에 주민 참여(자치)가 왜 필요한지 평가·주장 — 참여 없는 해결과 비교해 근거 제시" },
  { code: "블룸4사11", bloom: "창조", units: ["사회42_2_지역문제해결", "국어42_3_의견을모아서"], fusion: "교과 간",
    focus: "우리 지역 문제 하나를 골라 시청(구청)에 보내는 제안하는 글 쓰기 — 국어의 제안하는 글 짜임(문제 상황·제안·까닭) 활용" },
  { code: "블룸4사12", bloom: "창조", units: ["사회42_1_민주주의와자치", "도덕4_5_디지털사회"], fusion: "교과 간",
    focus: "온라인 학급회의 규칙 만들기 — 민주적 의사결정 원리와 디지털 예절을 결합해 규칙 3개 이상 설계하고 각각의 까닭 쓰기" },
];

const BLOOM_GUIDE = {
  기억: "배운 사실·용어·사례를 떠올려 쓰게 한다. 동사: 쓰세요, 말해 보세요. 단순 나열이라도 서술형으로 답할 수 있게 한다.",
  이해: "뜻과 까닭을 자기 말로 설명하게 한다. 동사: 설명하세요, 정리해 보세요, 예를 들어 보세요.",
  적용: "배운 원리를 새로운(문항이 제시한) 상황에 써 보게 한다. 동사: 적용해 보세요, 계획을 세워 보세요.",
  분석: "비교·구분·원인과 결과를 따지게 한다. 동사: 비교하세요, 공통점과 차이점을 찾으세요, 까닭을 분석하세요.",
  평가: "기준을 세워 판단하고 근거를 대게 한다. 동사: 판단하세요, 어느 쪽이 더 나은지 근거와 함께 쓰세요.",
  창조: "새로운 것을 설계·제안하게 한다. 동사: 만들어 보세요, 제안하는 글을 쓰세요, 설계하세요.",
};

// ── 스타일 예시: 생각교실 4학년 사회에서 2개 ──────────────────────
async function exemplars() {
  const rows = await (await fetch(
    `${U}/rest/v1/assessments?settingname=in.(${encodeURIComponent("생각교실4사05,생각교실4사09")})&select=settingname,question1,question2,question3,correctanswer1,feedbackinstruction`,
    { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();
  return rows.map((r) =>
    `[예시 ${r.settingname}]\n문항1: ${r.question1}\n문항2: ${r.question2 || "(없음)"}\n문항3: ${r.question3 || "(없음)"}\n모범답안1: ${r.correctanswer1}\n평가 주의 사항(루브릭): ${r.feedbackinstruction}`
  ).join("\n\n");
}

const GEN_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    title: { type: "string", description: "과제명 — 과제 내용을 나타내는 구 (예: 민주주의 실천 사례 떠올려 쓰기). 번호·코드·괄호 금지, 30자 이내" },
    question1: { type: "string" }, question2: { type: "string" }, question3: { type: "string" },
    correctanswer1: { type: "string" }, correctanswer2: { type: "string" }, correctanswer3: { type: "string" },
    feedbackinstruction: { type: "string", description: "평가 주의 사항 — 문항별 4/3/2점 기준을 요소·개수로 명시" },
  },
  required: ["title", "question1", "question2", "question3",
             "correctanswer1", "correctanswer2", "correctanswer3", "feedbackinstruction"],
};

async function generate(item, style) {
  const srcText = item.units.map((u) => `«${u}»\n${excerpt(src(u))}`).join("\n\n────────\n\n");
  const res = await next().responses.create({
    model: "gpt-4o", temperature: 0.4,
    instructions: `당신은 초등 서·논술형 평가 문항 설계 전문가입니다. 지도서 발췌를 근거로 평가 문항 세트를 만듭니다.
함께 주어지는 '생각을 키우는 교실' 예시는 참조용입니다 — 어조·눈높이를 감 잡는 데 쓰되,
그 형식이나 구성을 따라야 할 의무는 없습니다. 이 문항에 가장 알맞은 구성을 스스로 정하세요.

[반드시 지킬 것 — 앱이 요구하는 최소 조건]
1. Bloom 수준 "${item.bloom}" — ${BLOOM_GUIDE[item.bloom]}
2. 문항은 텍스트만으로 완결합니다. 그림·사진·표·그래프·영상·별도 자료를 절대 참조하지 않습니다.
   상황이나 자료가 필요하면 문항 본문 안에 글로 서술해 넣습니다 (예: "[상황] ○○시는 …").
3. 소문항은 1~3개. 안 쓰는 슬롯은 빈 문자열. 각 소문항마다 모범답안을 같은 번호에 씁니다.
4. 모범답안은 그 문항이 요구하는 요소를 하나도 빠짐없이 담습니다. 개수 조건("2가지 이상")이 있으면 그 개수를 채웁니다.
   4학년 학생이 실제로 쓸 수 있는 어휘와 문장으로 씁니다.
5. 평가 주의 사항에는 채점자가 쓸 수 있는 기준이 담겨야 합니다. 형태는 자유입니다.
6. 지도서 발췌의 개념·용어·활동을 근거로 하되, 지도서에 없는 사실을 지어내지 않습니다.
${item.fusion ? `7. 이 문항은 ${item.fusion} 융합 문항입니다. 두 소스의 내용이 실제로 결합되어야 합니다 — 한쪽만 쓰고 다른 쪽을 장식으로 두지 마세요.` : ""}

[이 문항의 초점] ${item.focus}`,
    input: `[참조용 예시 — 생각을 키우는 교실 (따를 의무 없음)]\n${style}\n\n[지도서 발췌]\n${srcText}`,
    text: { format: { type: "json_schema", name: "q", strict: true, schema: GEN_SCHEMA } },
  });
  return JSON.parse(res.output_text);
}

// ── 검증: 실제 채점 지침·프롬프트로 (grade/route.ts와 동일 형태) ────
const INS = readFileSync("src/lib/instructions.ts", "utf-8")
  .match(/export const STUDENT_INSTRUCTIONS = `([\s\S]*?)`;/)[1];
const SENTENCE_END = /(다|요|까|죠|네|군요|습니다|입니다)[.!?]?$|[.!?]$/;
function formHint(ma) {
  const a = (ma || "").trim(); if (!a) return "";
  const form = (a.match(/[.!?]/g) || []).length >= 2 || SENTENCE_END.test(a) || a.length > 60 ? "서술"
    : /[,、·]/.test(a) ? "나열" : a.length <= 8 ? "낱말" : "구";
  if (form === "서술") return "기대하는 답안 형태: 문장 서술. 완성된 문장으로 서술했는지를 채점에 반영합니다. 단, 교사 모범답안이 담고 있는 것까지만 요구합니다.";
  const label = { 낱말: "낱말", 나열: "낱말 나열", 구: "짧은 구(句)" }[form];
  return `기대하는 답안 형태: ${label}. 이 문항의 정답은 완성된 문장이 아니라 ${label} 형태입니다. 교사 모범답안과 같은 내용을 ${label} 형태로 정확히 답했다면 4점입니다. '완성된 문장이 아니다', '설명이 부족하다'는 이유로 감점하지 않습니다.`;
}
const scoreOf = (t) => {
  const l = t.match(/채점\s*결과\s*[:：]\s*([^\n]*)/); if (!l) return null;
  const m = l[1].replace(/^[(\s*_`]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·*_`]|$)/);
  return m?.[1].replace(/[*_`]/g, "").trim() || null;
};
async function gradeLocal(item, slot, answer, unitTitle) {
  const q = item[`question${slot}`], ca = item[`correctanswer${slot}`];
  const input = `${slot}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
문항, 학생 답안, 채점 결과, 피드백 내용을 문단으로 나눠 주세요.

[자료 검색 힌트] 이 평가가 속한 단원·과제: ${unitTitle}
이 줄은 file_search로 관련 교과서(지도서) 내용을 찾기 위한 힌트일 뿐이며, 채점 기준이 아닙니다.
여기 적힌 과제 전체를 학생이 수행했는지 묻지 마세요. 채점은 아래 '문항'에 적힌 것만을 기준으로 합니다.
이 단원의 교과서 쪽 범위 정보가 없습니다. 쪽수를 추측해서 쓰지 말고, '이 단원의 ○○ 부분'처럼 내용으로 안내하세요.
${formHint(ca)}
평가 주의 사항: ${item.feedbackinstruction}
교사가 등록한 모범답안(채점 기준으로 참고): ${ca}
문항: ${q}
학생 답안: ${answer}`;
  let r = await next().responses.create({ model: "gpt-4o", instructions: INS, input, temperature: 0.01, top_p: 0.01 });
  let out = (r.output_text || "").trim();
  // "모르겠어요"를 잡담으로 오인한 채점 거부 → 한 번 재시도 (grade/route.ts와 동일)
  if (!/채점\s*결과/.test(out)) {
    r = await next().responses.create({ model: "gpt-4o", instructions: INS,
      input: input + `\n\n[중요] 위 학생 답안이 "모르겠다"는 내용이어도 그것은 잡담이 아니라 답안입니다. 거부하지 말고 반드시 '채점 결과:' 형식으로 최저 수준 채점과 격려 피드백을 작성하세요.`,
      temperature: 0.01, top_p: 0.01 });
    out = (r.output_text || "").trim();
  }
  return scoreOf(out);
}
const isTop = (s) => /^4|매우/.test(s || "");
const isLowish = (s) => /^[12]|노력|보통/.test(s || "");
const badRefs = (t) => /(그림|사진|표\s?[0-9]|그래프|영상|자료\s?[0-9]|다음 (그림|사진|표|그래프))/.test(t || "");

// ── 실행 ───────────────────────────────────────────────────────────
const only = process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : null;
const plan = only ? PLAN.filter((p) => p.code === only) : PLAN;
const style = await exemplars();
console.log(`▶ ${plan.length}문항 생성 + 검증\n`);

const out = [];
for (const item of plan) {
  process.stdout.write(`  ${item.code} [${item.bloom}${item.fusion ? " · " + item.fusion : ""}] 생성…`);
  try {
    const g = await generate(item, style);
    const slots = [1, 2, 3].filter((i) => (g[`question${i}`] || "").trim());
    // 검증 1: 그림·표 참조 금지
    const refFail = slots.some((i) => badRefs(g[`question${i}`]));
    // 검증 2: 각 슬롯 모범답안 → 만점
    const perfect = await Promise.all(slots.map((i) => gradeLocal(g, i, g[`correctanswer${i}`], g.title)));
    // 검증 3: 슬롯1 오답 → 낮은 점수
    const wrongScore = await gradeLocal(g, slots[0], "잘 모르겠어요", g.title);
    const ceilingOK = perfect.every(isTop);
    const floorOK = isLowish(wrongScore);
    const pass = !refFail && ceilingOK && floorOK;
    out.push({ ...item, ...g, slots, perfectScores: perfect, wrongScore,
               checks: { refFail, ceilingOK, floorOK }, pass });
    console.log(` ${pass ? "✅" : "⚠️"}  천장:${perfect.join("/")} 오답:${wrongScore}${refFail ? " 자료참조!" : ""}`);
  } catch (e) {
    out.push({ ...item, error: String(e).slice(0, 120), pass: false });
    console.log(" ❌", String(e).slice(0, 60));
  }
}

writeFileSync(`${SCRATCH}/bloom-questions.json`, JSON.stringify(out, null, 1));

// 검토용 MD
let md = `# 4학년 사회 — Bloom 6단계 자동 생성 문항 (검토용)\n\n`;
md += `생성 ${out.length}문항 · 검증 통과 ${out.filter((x) => x.pass).length}문항 · ${new Date().toISOString().slice(0, 10)}\n`;
md += `검증 = ①그림·표 참조 없음 ②모범답안 그대로 제출 시 만점 ③오답 제출 시 낮은 점수\n\n---\n\n`;
for (const x of out) {
  md += `## ${x.code} — ${x.bloom}${x.fusion ? ` (${x.fusion} 융합)` : ""} ${x.pass ? "✅" : "⚠️ 검토 필요"}\n\n`;
  if (x.error) { md += `생성 실패: ${x.error}\n\n---\n\n`; continue; }
  md += `**과제명**: ${x.title}\n**근거 단원**: ${x.units.join(" + ")}\n**검증**: 천장 ${x.perfectScores.join("/")} · 오답 ${x.wrongScore}\n\n`;
  for (const i of x.slots) {
    md += `**문항${i}**\n${x[`question${i}`]}\n\n**모범답안${i}**\n${x[`correctanswer${i}`]}\n\n`;
  }
  md += `**평가 주의 사항(루브릭)**\n${x.feedbackinstruction}\n\n---\n\n`;
}
writeFileSync(`${SCRATCH}/bloom-questions-review.md`, md);
console.log(`\n통과 ${out.filter((x) => x.pass).length}/${out.length}`);
console.log(`검토 파일: ${SCRATCH}/bloom-questions-review.md`);
