// 생각교실 모범답안 전수 검사.
//
// 왜 필요한가: 채점 기준이 교사 모범답안에 고정되면서(fa00860), 모범답안이
// 문항의 요구를 다 담지 못하면 그 부족한 만큼이 곧 채점 기준이 된다.
//   예) 6과03 문항: "꽃의 구조 이름을 쓰고, 각각 어떤 일을 하는지 설명하세요"
//       모범답안:   "암술, 수술, 꽃받침, 꽃잎"  ← 기능 설명이 없음
//       → 이름만 쓴 학생도 만점을 받고, 기능까지 설명한 학생과 구분되지 않는다.
//
// 원인: 원본 PDF의 예시 답안은 문항 전체를 아우르는 한 덩어리인데, 시트로 옮기며
// question1~3 슬롯으로 쪼갤 때 답의 조각만 배정된 자리가 생겼다.
//
// 판정 방식: 교과서를 뒤지지 않는다. "문항이 명시적으로 요구한 것"과 "모범답안이
// 담고 있는 것"만 대조한다. 결함의 형태가 '세 가지를 묻는데 하나만 답함'이라
// 내용 지식 없이도 판정되고, file_search를 빼면 비용이 한 자릿수 배로 줄어든다.
//
// 실행: node scripts/audit-model-answers.mjs [--limit N] [--concurrency N]
// 결과: scripts/model-answer-audit.json

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}

const argv = process.argv.slice(2);
const argOf = (name, dflt) => {
  const i = argv.indexOf(name);
  return i >= 0 ? parseInt(argv[i + 1]) : dflt;
};
const LIMIT = argOf("--limit", Infinity);
const CONCURRENCY = argOf("--concurrency", 8);

const KEYS = process.env.OPENAI_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
const clients = KEYS.map((k) => new OpenAI({ apiKey: k }));

const FILES = ["thinking-class-rows.json", "thinking-class-rows-g3.json", "thinking-class-rows-g4.json",
  "thinking-class-rows-g5.json", "thinking-class-rows-g6.json"];
let rows = [];
for (const f of FILES) rows = rows.concat(JSON.parse(readFileSync(`scripts/${f}`, "utf-8")));
const seen = new Set();
rows = rows.filter((r) => !seen.has(r.settingname) && seen.add(r.settingname));

// 문항이 있고 모범답안도 있는 슬롯만. (모범답안이 없는 건 별개 사안이고,
// 창작 문항처럼 비어 있는 게 옳은 경우도 있다)
const slots = [];
for (const r of rows) {
  for (const i of [1, 2, 3]) {
    const q = (r[`question${i}`] || "").trim();
    const a = (r[`correctanswer${i}`] || "").trim();
    if (q && a) slots.push({ code: r.settingname, slot: i, grade: r.grade, subject: r.subject, unit: r.unit, question: q, answer: a });
  }
}
const targets = slots.slice(0, LIMIT);

const INSTRUCTIONS = `당신은 초등 서·논술형 평가 문항을 검토하는 교육 전문가입니다.
주어진 '문항'과 '교사 모범답안'을 대조해, 모범답안이 그 문항이 요구하는 것을 모두 담고 있는지 판정합니다.

[판정 원칙]
- 기준은 오직 문항 본문입니다. 문항이 명시적으로 요구한 것만 요구 요소로 셉니다.
- 문항에 없는 것을 요구 요소로 만들어내지 않습니다. 더 자세히 쓰면 좋겠다는 것은 결함이 아닙니다.
- 답의 형태(낱말·나열·문장·문단)는 문항이 정합니다. 문항이 낱말이나 나열을 요구하면
  모범답안이 짧은 것은 정상이며 결함이 아닙니다.
- 문항이 두 가지 이상을 요구하는데(예: "쓰고, 설명하세요" / "무엇인가요? 그리고 ~쓰세요")
  모범답안이 그중 일부만 답하고 있으면 '부족'입니다.
- 문항이 학생 개인의 경험·상상·의견을 요구하면, 모범답안이 예시 하나만 보여도 '충분'입니다.
- 애매하면 '충분'으로 판정합니다. 잘못된 지적이 누락보다 비쌉니다.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    required: { type: "array", items: { type: "string" }, description: "문항이 명시적으로 요구하는 요소들" },
    missing: { type: "array", items: { type: "string" }, description: "모범답안에 빠진 요소. 없으면 빈 배열" },
    verdict: { type: "string", enum: ["충분", "부족"] },
    note: { type: "string", description: "판정 이유 한 문장" },
  },
  required: ["required", "missing", "verdict", "note"],
};

let cursor = 0;
async function audit(t) {
  const client = clients[cursor++ % clients.length];
  const input = `문항: ${t.question}\n\n교사 모범답안: ${t.answer}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt + Math.random() * 1000));
    try {
      const res = await client.responses.create({
        model: "gpt-4o",
        instructions: INSTRUCTIONS,
        input,
        temperature: 0.01,
        text: { format: { type: "json_schema", name: "audit", strict: true, schema: SCHEMA } },
      });
      return { ...t, ...JSON.parse(res.output_text) };
    } catch (e) {
      if (attempt === 2) return { ...t, verdict: "오류", missing: [], required: [], note: String(e).slice(0, 120) };
    }
  }
}

console.log(`▶ 검사 대상 ${targets.length}자리 (문항 ${rows.length}개) — 동시 ${CONCURRENCY}, 키 ${KEYS.length}개\n`);

const results = [];
let done = 0;
const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const t = queue.shift();
    results.push(await audit(t));
    if (++done % 50 === 0) console.log(`  ${done}/${targets.length} …`);
  }
}));

results.sort((a, b) => a.code.localeCompare(b.code) || a.slot - b.slot);
writeFileSync("scripts/model-answer-audit.json", JSON.stringify(results, null, 1));

const bad = results.filter((r) => r.verdict === "부족");
const err = results.filter((r) => r.verdict === "오류");

console.log(`\n═══ 결과 ═══`);
console.log(`검사: ${results.length}자리   충분: ${results.length - bad.length - err.length}   부족: ${bad.length}   오류: ${err.length}\n`);

const byGrade = {};
for (const r of bad) (byGrade[`${r.grade}학년 ${r.subject}`] ??= []).push(r);
for (const [k, v] of Object.entries(byGrade).sort()) {
  console.log(`■ ${k} — ${v.length}건`);
  for (const r of v) {
    console.log(`  ${r.code} 슬롯${r.slot}`);
    console.log(`    문항: ${r.question.replace(/\s+/g, " ").slice(0, 90)}`);
    console.log(`    답안: ${r.answer.replace(/\s+/g, " ").slice(0, 70)}`);
    console.log(`    빠짐: ${r.missing.join(" / ")}`);
  }
  console.log();
}
if (err.length) console.log(`⚠ 오류 ${err.length}건: ${err.map((e) => e.code + "-" + e.slot).join(", ")}`);
console.log(`전체 결과: scripts/model-answer-audit.json`);
