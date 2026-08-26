// 모범답안 결함 확정 — 실제 채점 경로로 판정한다.
//
// audit(1차)·triage(2차)는 문항과 모범답안의 텍스트만 대조하는 대용품이다.
// 실측으로 검증해둔 8건과 대조해보니 진짜 결함 2건은 둘 다 잡았지만 정상 6건 중
// 3건을 결함으로 오탐했다. 그 목록을 그대로 넘기면 멀쩡한 문항을 고치게 된다.
//
// 그래서 원래 정의로 돌아간다: "모범답안을 그대로 낸 학생이 만점을 받는가."
// src/app/api/grade/route.ts와 같은 프롬프트로, 교사 모범답안을 학생 답안으로
// 제출해 채점한다. 최고점이 안 나오면 그 모범답안이 문항의 요구를 다 담지 못한 것이다.
//
// 형태 판정(answerFormHint)은 src/lib/answer-form.ts를 옮겨온 것이다. .ts를 node에서
// 직접 못 읽어서인데, 원본이 바뀌면 여기도 함께 고쳐야 한다.
//
// 실행: node scripts/verify-model-answers.mjs [--control N] [--concurrency N]
// 결과: scripts/model-answer-verified.json

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? parseInt(argv[i + 1]) : d; };
const CONTROL = argOf("--control", 30);
const CONCURRENCY = argOf("--concurrency", 8);

const KEYS = process.env.OPENAI_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
const clients = KEYS.map((k) => new OpenAI({ apiKey: k }));
const INS = readFileSync("src/lib/instructions.ts", "utf-8")
  .match(/export const STUDENT_INSTRUCTIONS = `([\s\S]*?)`;/)[1];

// ── src/lib/answer-form.ts 사본 ────────────────────────────────────
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

const audit = JSON.parse(readFileSync("scripts/model-answer-audit.json", "utf-8"));
const triage = JSON.parse(readFileSync("scripts/model-answer-triage.json", "utf-8"));

// --all:     모범답안이 있는 모든 슬롯을 실제 채점한다. 1·2차 검사기를 거치지 않으므로
//            그 오탐·미탐에 좌우되지 않는다. 가장 정확하고 가장 비싸다.
// --recheck: 앞선 실행에서 결함으로 확정된 것만 다시 본다 (프롬프트를 고친 뒤 재확인용)
const ALL = argv.includes("--all");
const RECHECK = argv.includes("--recheck");
const suspects = ALL
  ? audit.map((a) => ({ ...a, group: "의심" }))
  : RECHECK
  ? JSON.parse(readFileSync("scripts/model-answer-verified.json", "utf-8"))
      .filter((r) => r.full === false).map((r) => ({ ...r, group: "의심" }))
  : triage.filter((t) => t.category === "내용누락").map((t) => ({ ...t, group: "의심" }));

// 대조군: 1차가 '충분'이라 한 것 중 일부. 놓친 결함(미탐)이 있는지 본다.
// 순서를 고정하려고 코드 해시로 뽑는다 — 재실행해도 같은 표본이어야 비교가 된다.
// --all에서는 전부를 보므로 대조군을 따로 두지 않는다(같은 슬롯을 두 번 채점하게 된다).
const okAll = audit.filter((a) => a.verdict === "충분");
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
const control = ALL ? [] : [...okAll].sort((a, b) => hash(a.code + a.slot) - hash(b.code + b.slot))
  .slice(0, CONTROL).map((a) => ({ ...a, group: "대조" }));

const targets = [...suspects, ...control];

const scoreOf = (t) => {
  const l = t.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!l) return null;
  const m = l[1].replace(/^[(\s*_`]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·*_`]|$)/);
  return m?.[1].replace(/[*_`]/g, "").trim() || null;
};
const isFull = (s) => /4|매우\s*우수|상|능숙|도달/.test(s || "");

let cursor = 0;
async function verify(t) {
  const row = rowOf.get(t.code);
  const p = (row.unitkey || "").split("|");
  const ca = row[`correctanswer${t.slot}`] || "";
  const input = `${t.slot}번 문항에 대해 학생의 답안을 채점하고,
** instructions에 따라 1~5문단 형식으로 피드백을 작성해주세요.
문항, 학생 답안, 채점 결과, 피드백 내용을 문단으로 나눠 주세요.

[자료 검색 힌트] 이 평가가 속한 단원·과제: ${p.slice(4).join("|")}
이 줄은 file_search로 관련 교과서(지도서) 내용을 찾기 위한 힌트일 뿐이며, 채점 기준이 아닙니다.
여기 적힌 과제 전체를 학생이 수행했는지 묻지 마세요. 채점은 아래 '문항'에 적힌 것만을 기준으로 합니다.
이 단원의 교과서 쪽 범위 정보가 없습니다. 쪽수를 추측해서 쓰지 말고, '이 단원의 ○○ 부분'처럼 내용으로 안내하세요.
${answerFormHint(ca)}
평가 주의 사항: ${row.feedbackinstruction || "(없음)"}
교사가 등록한 모범답안(채점 기준으로 참고하되, instructions의 수준별 피드백 규칙을 따를 것 — 최고 수준이 아닐 때는 모범답안 전체를 그대로 노출하지 않기): ${ca}
문항: ${row[`question${t.slot}`]}
학생 답안: ${ca}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const client = clients[cursor++ % clients.length];
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt + Math.random() * 1200));
    try {
      const r = await client.responses.create({
        model: "gpt-4o", instructions: INS, input, temperature: 0.01, top_p: 0.01,
        tools: [{ type: "file_search", vector_store_ids: [process.env.LIBRARY_VECTORSTORE_ID],
                  filters: { key: "bookKey", type: "eq", value: p.slice(0, 4).join("|") } }],
      });
      const text = (r.output_text || "").trim();
      const s = scoreOf(text);
      return { code: t.code, slot: t.slot, grade: row.grade, subject: row.subject, unit: row.unit,
               group: t.group, score: s, full: isFull(s),
               question: row[`question${t.slot}`], answer: ca,
               auditMissing: t.missing || [],
               reason: ((text.match(/채점\s*결과[^\n]*/) || [""])[0] || "").replace(/^.*?-\s*/, "").slice(0, 140) };
    } catch (e) {
      if (attempt === 2) return { code: t.code, slot: t.slot, group: t.group, score: null, full: null, error: String(e).slice(0, 120) };
    }
  }
}

console.log(`▶ 의심 ${suspects.length}건 + 대조군 ${control.length}건 = ${targets.length}건 실제 채점 — 동시 ${CONCURRENCY}\n`);
const results = [];
let done = 0;
const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    results.push(await verify(queue.shift()));
    if (++done % 25 === 0) console.log(`  ${done}/${targets.length} …`);
  }
}));

results.sort((a, b) => a.code.localeCompare(b.code) || a.slot - b.slot);
// 재확인 결과가 원본을 덮어쓰지 않게 한다 — 비교하려면 둘 다 남아 있어야 한다
const OUT = ALL ? "scripts/model-answer-full.json" : RECHECK ? "scripts/model-answer-recheck.json" : "scripts/model-answer-verified.json";
writeFileSync(OUT, JSON.stringify(results, null, 1));

const S = results.filter((r) => r.group === "의심");
const C = results.filter((r) => r.group === "대조");
const confirmed = S.filter((r) => r.full === false);
const falsePos = S.filter((r) => r.full === true);
const missed = C.filter((r) => r.full === false);

console.log(`\n═══ 확정 결과 ═══`);
console.log(`의심 ${S.length}건 → 진짜 결함 ${confirmed.length}건 / 멀쩡함(오탐) ${falsePos.length}건`);
console.log(`대조 ${C.length}건 → 만점 ${C.filter((r) => r.full).length}건 / 만점 아님(검사기가 놓침) ${missed.length}건`);
console.log(`오류 ${results.filter((r) => r.full === null).length}건\n`);

console.log(`■ 고쳐야 할 모범답안 ${confirmed.length}건\n`);
const g = {};
for (const r of confirmed) (g[`${r.grade}학년 ${r.subject}`] ??= []).push(r);
for (const [k, v] of Object.entries(g).sort()) {
  console.log(`── ${k} (${v.length}건)`);
  for (const r of v) console.log(`   ${r.code} 슬롯${r.slot} [${r.score}] ${r.reason.slice(0, 80)}`);
}
if (missed.length) {
  console.log(`\n⚠ 검사기가 '충분'이라 했지만 만점이 안 나온 것 ${missed.length}건`);
  for (const r of missed) console.log(`   ${r.code} 슬롯${r.slot} [${r.score}] ${(r.reason || "").slice(0, 80)}`);
}
console.log(`\n전체: ${OUT}`);
