// 결함으로 확정된 모범답안의 보강안을 만든다.
//
// 대상: verify --all이 만점을 못 준 38자리 (scripts/model-answer-full.json).
// 방식: 지도서 벡터스토어를 근거로, 현재 모범답안에서 빠진 부분만 채운다.
//       처음부터 다시 쓰지 않는다 — 교사가 쓴 표현과 관점을 남겨야 검토가 쉽고,
//       원본 PDF의 예시 답안이 이미 그 학년 눈높이에 맞춰져 있다.
// 검증: 만든 답안을 다시 학생 답안으로 제출해 채점한다. 만점이 나와야 보강이 된 것이다.
//
// 실행: node scripts/draft-model-answers.mjs [--limit N] [--concurrency N]
// 결과: scripts/model-answer-drafts.json (본문 포함 — gitignore 대상)
//       scripts/model-answer-drafts.md   (검토용 대조표)

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? parseInt(argv[i + 1]) : d; };
const LIMIT = argOf("--limit", Infinity);
const CONCURRENCY = argOf("--concurrency", 6);

const KEYS = process.env.OPENAI_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
const clients = KEYS.map((k) => new OpenAI({ apiKey: k }));
const src = readFileSync("src/lib/instructions.ts", "utf-8");
const STUDENT_INS = src.match(/export const STUDENT_INSTRUCTIONS = `([\s\S]*?)`;/)[1];
const TEACHER_INS = src.match(/export const TEACHER_INSTRUCTIONS = `([\s\S]*?)`;/)[1];

// ── src/lib/answer-form.ts 사본 (원본이 바뀌면 여기도 함께) ─────────
const SENTENCE_END = /(다|요|까|죠|네|군요|습니다|입니다)[.!?]?$|[.!?]$/;
function detectAnswerForm(ma) {
  const a = (ma || "").trim();
  if (!a) return null;
  if ((a.match(/[.!?]/g) || []).length >= 2) return "서술";
  if (SENTENCE_END.test(a)) return "서술";
  if (a.length > 60) return "서술";
  if (/[,、·]/.test(a)) return "나열";
  return a.length <= 8 ? "낱말" : "구";
}
function answerFormHint(ma) {
  const form = detectAnswerForm(ma);
  if (!form) return "";
  if (form === "서술") return "기대하는 답안 형태: 문장 서술. 완성된 문장으로 서술했는지를 채점에 반영합니다. 단, 교사 모범답안이 담고 있는 것까지만 요구합니다.";
  const label = { 낱말: "낱말", 나열: "낱말 나열", 구: "짧은 구(句)" }[form];
  return `기대하는 답안 형태: ${label}. 이 문항의 정답은 완성된 문장이 아니라 ${label} 형태입니다. 교사 모범답안과 같은 내용을 ${label} 형태로 정확히 답했다면 4점입니다. '완성된 문장이 아니다', '설명이 부족하다'는 이유로 감점하지 않습니다.`;
}
// ───────────────────────────────────────────────────────────────────

const FILES = ["thinking-class-rows.json", "thinking-class-rows-g3.json", "thinking-class-rows-g4.json",
  "thinking-class-rows-g5.json", "thinking-class-rows-g6.json"];
let allRows = [];
for (const f of FILES) allRows = allRows.concat(JSON.parse(readFileSync(`scripts/${f}`, "utf-8")));
const rowOf = new Map(allRows.map((r) => [r.settingname, r]));

const defects = JSON.parse(readFileSync("scripts/model-answer-full.json", "utf-8"))
  .filter((r) => r.full === false).slice(0, LIMIT);

const scoreOf = (t) => {
  const l = t.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!l) return null;
  const m = l[1].replace(/^[(\s*_`]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·*_`]|$)/);
  return m?.[1].replace(/[*_`]/g, "").trim() || null;
};
const isFull = (s) => /4|매우\s*우수|상|능숙|도달/.test(s || "");

let cursor = 0;
const next = () => clients[cursor++ % clients.length];

async function call(opts, tries = 3) {
  let last;
  for (let i = 0; i < tries; i++) {
    if (i > 0) await new Promise((r) => setTimeout(r, 1200 * i + Math.random() * 1200));
    try { return await next().responses.create(opts); } catch (e) { last = e; }
  }
  throw last;
}

async function draft(d) {
  const row = rowOf.get(d.code);
  const p = (row.unitkey || "").split("|");
  const bookKey = p.slice(0, 4).join("|");
  const question = row[`question${d.slot}`];
  const before = row[`correctanswer${d.slot}`] || "";
  const tools = [{ type: "file_search", vector_store_ids: [process.env.LIBRARY_VECTORSTORE_ID],
                   filters: { key: "bookKey", type: "eq", value: bookKey } }];

  // 1) 보강안 생성
  const input = `${row.grade}학년 ${row.subject} 서·논술형 문항의 교사 모범답안을 보강합니다.

이 모범답안은 문항이 요구한 것 중 일부를 담지 못하고 있습니다. 채점기가 지적한 부족한 점:
${d.reason}

[해야 할 일]
현재 모범답안을 살리면서, 빠진 부분만 채워 완성된 모범답안을 만드세요.
- 현재 답안의 표현과 관점을 최대한 그대로 두고, 없는 내용을 덧붙이는 방식으로 씁니다. 처음부터 다시 쓰지 마세요.
- 문항이 개수·문단 수·문장 수·형식을 지정했다면(예: "두 가지 이상", "5문단으로", "속담 2개 사용") 실제로 그 조건을 충족시키세요.
- ${row.grade}학년 학생이 실제로 쓸 수 있는 수준과 어휘로 씁니다. 어른의 문장이 아니라 그 학년 아이의 좋은 답안이어야 합니다.
- 문항이 요구하지 않은 내용을 덧붙여 길게 만들지 마세요. 요구된 것까지만 채웁니다.
- 모범답안 본문만 출력합니다. 설명·머리말·따옴표·"모범답안:" 같은 라벨을 붙이지 마세요.

[단원·과제] ${p.slice(4).join("|")}
[문항] ${question}
[현재 모범답안] ${before}
[교사가 쓴 평가 주의 사항] ${row.feedbackinstruction || "(없음)"}`;

  const gen = await call({ model: "gpt-4o", instructions: TEACHER_INS, input, temperature: 0.2, tools });
  const after = (gen.output_text || "").trim().replace(/^["'`]|["'`]$/g, "");
  if (!after) return { ...d, after: "", newScore: null, fixed: false, error: "빈 응답" };

  // 2) 보강안을 학생 답안으로 제출해 채점 — 만점이 나와야 보강된 것
  const gradeInput = `${d.slot}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
문항, 학생 답안, 채점 결과, 피드백 내용을 문단으로 나눠 주세요.

[자료 검색 힌트] 이 평가가 속한 단원·과제: ${p.slice(4).join("|")}
이 줄은 file_search로 관련 교과서(지도서) 내용을 찾기 위한 힌트일 뿐이며, 채점 기준이 아닙니다.
여기 적힌 과제 전체를 학생이 수행했는지 묻지 마세요. 채점은 아래 '문항'에 적힌 것만을 기준으로 합니다.
이 단원의 교과서 쪽 범위 정보가 없습니다. 쪽수를 추측해서 쓰지 말고, '이 단원의 ○○ 부분'처럼 내용으로 안내하세요.
${answerFormHint(after)}
평가 주의 사항: ${row.feedbackinstruction || "(없음)"}
교사가 등록한 모범답안(채점 기준으로 참고하되, instructions의 수준별 피드백 규칙을 따를 것 — 최고 수준이 아닐 때는 모범답안 전체를 그대로 노출하지 않기): ${after}
문항: ${question}
학생 답안: ${after}`;

  const g = await call({ model: "gpt-4o", instructions: STUDENT_INS, input: gradeInput,
                         temperature: 0.01, top_p: 0.01, tools });
  const text = (g.output_text || "").trim();
  const newScore = scoreOf(text);
  return {
    code: d.code, slot: d.slot, grade: row.grade, subject: row.subject, unit: row.unit,
    question, before, after, oldScore: d.score, newScore, fixed: isFull(newScore),
    oldReason: d.reason,
    newReason: ((text.match(/채점\s*결과[^\n]*/) || [""])[0] || "").replace(/^.*?-\s*/, "").slice(0, 140),
  };
}

console.log(`▶ 결함 ${defects.length}건 보강안 생성 + 재채점 — 동시 ${CONCURRENCY}\n`);
const results = [];
let done = 0;
const queue = [...defects];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const d = queue.shift();
    try { results.push(await draft(d)); }
    catch (e) { results.push({ ...d, after: "", fixed: false, error: String(e).slice(0, 120) }); }
    if (++done % 10 === 0) console.log(`  ${done}/${defects.length} …`);
  }
}));

results.sort((a, b) => a.code.localeCompare(b.code) || a.slot - b.slot);
writeFileSync("scripts/model-answer-drafts.json", JSON.stringify(results, null, 1));

// 검토용 대조표
let md = `# 생각교실 모범답안 보강안 ${results.length}건\n\n`;
md += `각 항목의 "고친 뒤"를 학생 답안으로 제출해 다시 채점한 결과가 [ ] 안에 있습니다.\n`;
md += `만점이면 그 문항의 결함이 해소된 것입니다.\n\n`;
md += `**검토 방법**: "고친 뒤"가 그 학년 아이가 쓸 만한 답인지, 교육과정에 맞는지만 봐주세요.\n`;
md += `아니라고 판단되는 항목의 코드를 알려주시면 그 건은 반영하지 않습니다.\n\n---\n\n`;
for (const r of results) {
  md += `## ${r.code} 슬롯${r.slot} — ${r.grade}학년 ${r.subject} [${r.oldScore} → ${r.newScore}] ${r.fixed ? "✅" : "⚠️"}\n\n`;
  md += `**문항**\n${(r.question || "").replace(/\s+/g, " ")}\n\n`;
  md += `**지적된 점**\n${r.oldReason || ""}\n\n`;
  md += `**고치기 전**\n${r.before || "(없음)"}\n\n`;
  md += `**고친 뒤**\n${r.after || "(생성 실패)"}\n\n`;
  if (!r.fixed) md += `**⚠ 재채점에서도 만점이 안 나옴**: ${r.newReason || r.error || ""}\n\n`;
  md += `---\n\n`;
}
writeFileSync("scripts/model-answer-drafts.md", md);

const ok = results.filter((r) => r.fixed);
console.log(`\n═══ 결과 ═══`);
console.log(`보강 후 만점: ${ok.length}/${results.length}`);
const bad = results.filter((r) => !r.fixed);
if (bad.length) {
  console.log(`\n⚠ 보강해도 만점이 안 나온 ${bad.length}건 (사람이 봐야 함)`);
  for (const r of bad) console.log(`   ${r.code} 슬롯${r.slot} [${r.newScore || "오류"}] ${(r.newReason || r.error || "").slice(0, 80)}`);
}
console.log(`\n검토용 대조표: scripts/model-answer-drafts.md`);
