// 모범답안 전수 검사(audit-model-answers.mjs) 결과의 2차 분류.
//
// 1차는 "문항이 요구한 것 중 모범답안에 없는 것"을 찾는다. 그런데 생각교실 문항에는
// 글로 된 답에 담길 수 없는 요구가 섞여 있다 — "가치 사전을 만들어 봅시다",
// "짝에게 수정 의견을 받아 고쳐 쓰세요", "글과 그림으로 나타내어". 1차는 이런 것도
// 빠짐으로 세기 때문에 결함이 부풀려진다(493자리 중 160건 = 32%, 실제일 리 없다).
//
// 그래서 1차가 '부족'으로 표시한 건들만 다시 보고, 빠졌다는 것이 실제로 모범답안이
// 담아야 할 내용인지 가른다.
//
// 실행: node scripts/triage-model-answers.mjs [--concurrency N]
// 결과: scripts/model-answer-triage.json

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const i = argv.indexOf("--concurrency");
const CONCURRENCY = i >= 0 ? parseInt(argv[i + 1]) : 8;

const KEYS = process.env.OPENAI_API_KEYS.split(",").map((s) => s.trim()).filter(Boolean);
const clients = KEYS.map((k) => new OpenAI({ apiKey: k }));

const audit = JSON.parse(readFileSync("scripts/model-answer-audit.json", "utf-8"));
const targets = audit.filter((r) => r.verdict === "부족");

const INSTRUCTIONS = `당신은 초등 서·논술형 평가 자료를 검토하는 교육 전문가입니다.
어떤 문항에 대해, 교사 모범답안이 '무엇을 빠뜨렸다'는 1차 지적이 주어집니다.
그 지적이 타당한지, 그리고 어떤 성격인지 분류하세요.

[분류]
- "내용누락": 문항이 답으로 요구한 내용인데 모범답안에 실제로 없다. 학생이 글로 써야 하는
  것이고, 모범답안에 채워 넣을 수 있다. → 고쳐야 할 진짜 결함.
- "활동지시": 빠졌다는 것이 글로 된 답에 담길 수 없는 수업 활동·과정 지시다.
  (그림 그리기, 포트폴리오·사전 만들기, 짝과 검토하기, 발표하기, 조사해 오기 등)
  → 모범답안의 결함이 아니다.
- "형식조건": 빠졌다는 것이 분량·구성 요건이다. (5문단으로 쓰기, 각 문단 3문장 이상,
  속담 2개 넣기 등) 모범답안이 예시로서 그 형식을 갖추면 좋지만, 내용이 틀린 것은 아니다.
- "오탐": 지적이 틀렸다. 모범답안에 이미 그 내용이 담겨 있거나, 문항이 그것을 요구하지 않는다.

[원칙]
- 모범답안이 실제 답의 예시가 아니라 "~을 작성합니다", "~을 정리합니다" 같은 지시문에
  그치고 있다면, 그것은 "내용누락"입니다. 학생에게 보여줄 답이 없는 것과 같습니다.
- 애매하면 결함이 아닌 쪽으로 판정합니다.`;

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: ["내용누락", "활동지시", "형식조건", "오탐"] },
    reason: { type: "string", description: "판정 이유 한 문장" },
    fixable: { type: "boolean", description: "모범답안 텍스트를 고쳐서 해결되는가" },
  },
  required: ["category", "reason", "fixable"],
};

let cursor = 0;
async function triage(t) {
  const client = clients[cursor++ % clients.length];
  const input = `문항: ${t.question}

교사 모범답안: ${t.answer}

1차가 빠졌다고 지적한 것: ${t.missing.join(" / ")}`;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1000 * attempt + Math.random() * 1000));
    try {
      const res = await client.responses.create({
        model: "gpt-4o",
        instructions: INSTRUCTIONS,
        input,
        temperature: 0.01,
        text: { format: { type: "json_schema", name: "triage", strict: true, schema: SCHEMA } },
      });
      return { ...t, ...JSON.parse(res.output_text) };
    } catch (e) {
      if (attempt === 2) return { ...t, category: "오류", reason: String(e).slice(0, 120), fixable: false };
    }
  }
}

console.log(`▶ 1차 '부족' ${targets.length}건 재분류 — 동시 ${CONCURRENCY}\n`);
const results = [];
let done = 0;
const queue = [...targets];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    results.push(await triage(queue.shift()));
    if (++done % 40 === 0) console.log(`  ${done}/${targets.length} …`);
  }
}));

results.sort((a, b) => a.code.localeCompare(b.code) || a.slot - b.slot);
writeFileSync("scripts/model-answer-triage.json", JSON.stringify(results, null, 1));

const by = {};
for (const r of results) (by[r.category] ??= []).push(r);
console.log(`\n═══ 재분류 결과 (1차 부족 ${results.length}건) ═══`);
for (const k of ["내용누락", "형식조건", "활동지시", "오탐", "오류"]) {
  if (by[k]) console.log(`  ${k}: ${by[k].length}건`);
}

const real = by["내용누락"] || [];
console.log(`\n■ 실제로 고쳐야 할 모범답안: ${real.length}건\n`);
const g = {};
for (const r of real) (g[`${r.grade}학년 ${r.subject}`] ??= []).push(r);
for (const [k, v] of Object.entries(g).sort()) {
  console.log(`── ${k} (${v.length}건)`);
  for (const r of v) {
    console.log(`   ${r.code} 슬롯${r.slot} — 빠짐: ${r.missing.join(" / ").slice(0, 70)}`);
  }
}
console.log(`\n전체: scripts/model-answer-triage.json`);
