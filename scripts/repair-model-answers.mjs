// 생각교실 모범답안 보강.
//
// 문제: 원본 PDF의 예시 답안은 서·논술형 문항 전체를 아우르는 한 덩어리인데,
// import 과정에서 슬롯(question1~3)으로 쪼개면서 일부 슬롯에 답의 조각만 배정됐다.
//   예) 6과03 문항1 "꽃의 구조 이름을 쓰고 각각 어떤 일을 하는지 설명하세요"
//       → 모범답안이 "암술, 수술, 꽃받침, 꽃잎" (이름만, 기능 설명 없음)
// 그 결과 학생이 완벽하게 답해도 만점을 받을 수 없다.
//
// 판정 기준: 모범답안을 학생 답안으로 제출해 채점했을 때 최고 수준(4점)이 나오는가.
// 안 나오면 모범답안이 문항의 요구를 다 담지 못한 것이다.
// (짧아도 문항이 낱말·순서만 물으면 4점이 나온다. 길이로 판정하지 않는 이유.)
//
// 실행: node scripts/repair-model-answers.mjs [--limit N]
import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const args = process.argv.slice(2);
const LIMIT = parseInt((args[args.indexOf("--limit") + 1] || "9999"));
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEYS.split(",")[0].trim() });
const INS = readFileSync("src/lib/instructions.ts", "utf-8")
  .match(/export const STUDENT_INSTRUCTIONS = `([\s\S]*?)`;/)[1];

const files = ["thinking-class-rows.json", "thinking-class-rows-g3.json", "thinking-class-rows-g4.json",
  "thinking-class-rows-g5.json", "thinking-class-rows-g6.json"];
let rows = [];
for (const f of files) rows = rows.concat(JSON.parse(readFileSync(`scripts/${f}`, "utf-8")));
const cand = JSON.parse(readFileSync("/tmp/oeq_ans_cand.json", "utf-8")).slice(0, LIMIT);

const scoreOf = (t) => {
  const l = t.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!l) return null;
  const m = l[1].replace(/^[(\s]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·]|$)/);
  return m?.[1].trim() || null;
};
const num = (s) => { const m = (s || "").match(/(\d+)/); return m ? +m[1] : null; };

async function grade(row, slot, answer) {
  const p = (row.unitkey || "").split("|");
  const input = `${slot}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
문항, 학생 답안, 채점 결과, 피드백 내용을 문단으로 나눠 주세요.

이 평가의 단원: ${p.slice(4).join("|")} — file_search로 이 단원 관련 교과서(지도서) 내용을 찾아 근거로 채점하세요.
이 단원의 교과서 쪽 범위 정보가 없습니다. 쪽수를 추측해서 쓰지 말고, '이 단원의 ○○ 부분'처럼 내용으로 안내하세요.
평가 주의 사항: ${row.feedbackinstruction || "(없음)"}
교사가 등록한 모범답안(채점 기준으로 참고하되, 최고 수준이 아닐 때는 그대로 노출하지 않기): ${row[`correctanswer${slot}`] || ""}
문항: ${row[`question${slot}`]}
학생 답안: ${answer}`;
  const r = await client.responses.create({
    model: "gpt-4o", instructions: INS, input, temperature: 0.01, top_p: 0.01,
    tools: [{ type: "file_search", vector_store_ids: [process.env.LIBRARY_VECTORSTORE_ID],
              filters: { key: "bookKey", type: "eq", value: p.slice(0, 4).join("|") } }],
  });
  const t = (r.output_text || "").trim();
  return { s: scoreOf(t), reason: ((t.match(/채점\s*결과[^\n]*/) || [""])[0] || "").replace(/^.*?-\s*/, "").slice(0, 100) };
}

const GEN_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    answer: { type: "string", description: "이 문항의 요구를 모두 충족하는 모범답안" },
    note: { type: "string", description: "무엇을 보강했는지 한 줄 (40자 이내)" },
  },
  required: ["answer", "note"],
};
const GEN_INS = `너는 초등 서·논술형 평가의 모범답안을 작성하는 전문가다.
지금 모범답안은 문항이 요구한 것 중 일부만 담고 있어서, 학생이 완벽하게 답해도 만점이 나오지 않는다.

[할 일]
- PDF 원문의 "예시 답안"을 근거로, 이 문항이 요구한 것을 빠짐없이 담은 모범답안을 쓴다.
- 원문 예시 답안은 문항 전체를 아우르는 한 덩어리인 경우가 많다. 그중 이 문항에 해당하는 부분을 골라
  문항이 요구한 항목을 모두 채운다.
- 문항이 "A를 쓰고 B를 설명하세요"라면 A와 B가 모두 들어가야 한다.
- 학년 수준에 맞는 문장으로 쓴다. 실제 학생이 쓸 법한 좋은 답안이어야 한다.
- 문항이 낱말·순서·기호만 요구하면 짧은 답 그대로 둔다. 억지로 늘리지 않는다.
- 원문에 근거가 없으면 지어내지 말고 교육과정 수준의 일반적인 내용으로 채운다.`;

const chunks = {};
for (const g of ["3", "4", "5", "6"])
  chunks[g] = new Map(JSON.parse(readFileSync(`scripts/thinking-class-chunks-g${g}.json`, "utf-8")).map((c) => [c.no, c]));

const out = [];
let ok = 0, fixed = 0, still = 0;
for (const c of cand) {
  const row = rows.find((r) => r.settingname === c.code);
  const before = row[`correctanswer${c.slot}`] || "";
  const g0 = before ? await grade(row, c.slot, before) : { s: null, reason: "모범답안 없음" };
  if (num(g0.s) === 4) {
    ok++;
    console.log(`✅ ${c.code}-${c.slot} [${c.grade}학년 ${c.subject}] 현행 모범답안 4점 — 문제없음`);
    continue;
  }
  // 보강
  const chunk = chunks[String(c.grade)]?.get(row._no);
  const resp = await client.responses.create({
    model: "gpt-4o", instructions: GEN_INS, temperature: 0, max_output_tokens: 1500,
    input: `학년: ${row.grade}학년 / 교과: ${row.subject}
평가 과제: ${row.unit}
채점 기준: ${(row.feedbackinstruction || "").slice(0, 500)}

[문항]
${row[`question${c.slot}`]}

[현재 모범답안 — 요구를 다 담지 못했다]
${before || "(비어 있음)"}

[채점기가 지적한 부족한 점]
${g0.reason}

[PDF 원문]
${(chunk?.text || "").slice(0, 12000)}`,
    text: { format: { type: "json_schema", name: "ans", strict: true, schema: GEN_SCHEMA } },
  });
  let n;
  try { n = JSON.parse(resp.output_text); }
  catch (e) { console.log(`✗ ${c.code}-${c.slot} 생성 실패`); continue; }
  const after = (n.answer || "").trim();
  const g1 = await grade(row, c.slot, after);
  const good = num(g1.s) === 4;
  if (good) fixed++; else still++;
  out.push({ code: c.code, slot: c.slot, grade: c.grade, subject: c.subject, unit: row.unit,
             before, after, beforeScore: g0.s, afterScore: g1.s, note: (n.note || "").slice(0, 80), good });
  console.log(`${good ? "🔧" : "⚠️"} ${c.code}-${c.slot} [${c.grade}학년 ${c.subject}] ${g0.s || "없음"} → ${g1.s}  (${before.length}자 → ${after.length}자)`);
}
writeFileSync("/tmp/oeq_answers.json", JSON.stringify(out, null, 1));
console.log(`\n현행 정상 ${ok} / 보강 성공 ${fixed} / 보강 후에도 미달 ${still}`);
console.log(`→ /tmp/oeq_answers.json`);
