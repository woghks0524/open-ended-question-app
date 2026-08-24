// 생각교실 결함 문항 수리 — 정답 유출 부분만 잘라낸다.
//
// 배경: import-thinking-class.mjs v2의 정규화 프롬프트에 "정답을 문항에 넣지 말 것"이라는
// 금지 규칙이 없었다. 반대로 "문항만 읽어도 풀 수 있게 제시문·조건을 포함", "표는 문항
// 텍스트에 말로 풀어 넣고" 규칙이 있어서 예시 답안과 선택지 표까지 문항에 복사됐다.
//   최악 예) 6사15-2 "…'(정답 문장)'라는 내용을 청원의 취지로 쓰시오"
//
// 왜 재추출이 아니라 수술인가: 청크 전체를 다시 정규화하면 슬롯 배정이 달라져
// 문항 주제 자체가 바뀐다(3사06 문항2가 지능정보화→고령화로 바뀜). 교사가 이미 쓰는
// 코드라 문항 정체성은 유지해야 한다. 그래서 문항 문장은 두고 유출분만 제거한다.
//
// 실행: node scripts/repair-thinking-class.mjs [--limit N] [--out /tmp/oeq_repaired.json]
import OpenAI from "openai";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

for (const line of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const LIMIT = parseInt(opt("limit", "9999"));
const OUT = opt("out", "/tmp/oeq_repaired.json");
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEYS.split(",")[0].trim() });

const ROWFILES = ["thinking-class-rows.json", "thinking-class-rows-g3.json",
  "thinking-class-rows-g4.json", "thinking-class-rows-g5.json", "thinking-class-rows-g6.json"];
let rows = [];
for (const f of ROWFILES) rows = rows.concat(JSON.parse(readFileSync(`scripts/${f}`, "utf-8")));

export function longestShared(a, b) {
  a = a.replace(/\s+/g, ""); b = b.replace(/\s+/g, "");
  for (let L = Math.min(80, a.length); L >= 10; L--)
    for (let i = 0; i + L <= a.length; i++)
      if (b.includes(a.slice(i, i + L))) return [L, a.slice(i, i + L)];
  return [0, ""];
}

// 유출 후보 수집 (문항 단위)
const targets = [];
for (const r of rows) {
  for (const i of [1, 2, 3]) {
    const q = (r[`question${i}`] || "").trim(), a = (r[`correctanswer${i}`] || "").trim();
    if (!q || !a) continue;
    const [n, s] = longestShared(a, q);
    if (n >= 15) targets.push({ row: r, i, len: n, shared: s });
  }
}
console.log(`정답 유출 후보 ${targets.length}건`);

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    verdict: { type: "string", description: "leak(정답 유출이라 수정함) 또는 keep(유출이 아니라 그대로 둠)" },
    question: { type: "string", description: "수정된 문항 전문. keep이면 원문 그대로." },
    reason: { type: "string", description: "판단 근거 한 줄" },
  },
  required: ["verdict", "question", "reason"],
};

const INSTRUCTIONS = `너는 초등 서·논술형 평가 문항을 검수하는 전문가다.
문항 텍스트 안에 '모범답안 내용'이 들어가 학생이 생각하지 않고 베끼기만 해도 정답이 되는 경우를 고친다.

[수정해야 하는 경우 = leak]
- "예를 들어, ~입니다" 뒤에 모범답안의 결론·정의·목록이 그대로 붙어 있다.
  예) "민주주의의 뜻을 정의해 보세요. 예를 들어, 민주주의란 국민이 나라의 주인이 되어…"
- "N가지를 쓰시오"라고 요구하면서 그 N가지를 문항이 나열한다.
  예) "자석의 성질 세 가지를 모두 쓰고 … 자석의 성질은 A, B, C가 있습니다."
- 답이 될 문장을 따옴표로 지정한다.
  예) "'(정답 문장)'라는 내용을 청원의 취지로 쓰시오"

[그대로 두어야 하는 경우 = keep]
- 학생이 읽고 판단해야 할 제시문·기사·자료 본문 (자료는 근거일 뿐 답이 아니다)
- "A, B, C, D 중 두 가지를 골라"처럼 선택 범위를 주는 선택지 (범위 제시는 정답 제공이 아니다)
- 활동지의 단계 안내("1. ~를 적어봅시다 2. ~를 적어봅시다")
- 답의 형식·조건 안내("3문단으로", "2가지 이상 포함하여")

[수정 방법]
- 유출된 부분만 삭제하거나 "자신의 말로 정리해 보세요" 같은 요구로 바꾼다.
- 문항의 주제·요구사항·조건·형식 안내는 절대 바꾸지 않는다. 문항 정체성을 유지할 것.
- 삭제로 문항이 너무 앙상해지면, 답을 주지 않는 선에서 맥락만 남긴다.
  예) "자석의 성질 세 가지를 모두 쓰고…자석의 성질은 A, B, C가 있습니다."
      → "자석의 성질 세 가지를 모두 쓰고, 그중 내가 만들 장난감에 사용할 성질을 골라 설명하세요."
- 학년 수준에 맞는 쉬운 문장을 유지한다.`;

const out = [];
let leak = 0, keep = 0, fail = 0;

for (const t of targets.slice(0, LIMIT)) {
  const r = t.row;
  const q = r[`question${t.i}`].trim();
  const a = r[`correctanswer${t.i}`].trim();
  try {
    const resp = await client.responses.create({
      model: "gpt-4o", instructions: INSTRUCTIONS, temperature: 0,
      input: `학년: ${r.grade}학년 / 교과: ${r.subject}
평가 과제: ${r.unit}

[현재 문항]
${q}

[교사 모범답안 — 이 내용이 문항에 들어가 있으면 유출이다]
${a}

[문항과 모범답안이 공유하는 최장 문자열 ${t.len}자]
${t.shared}`,
      text: { format: { type: "json_schema", name: "repair", strict: true, schema: SCHEMA } },
    });
    const n = JSON.parse(resp.output_text);
    const [after] = longestShared(a, n.question || "");
    if (n.verdict === "leak") leak++; else keep++;
    out.push({ code: r.settingname, grade: r.grade, subject: r.subject, unit: r.unit,
               slot: t.i, before: q, after: (n.question || "").trim(),
               verdict: n.verdict, reason: n.reason, leakBefore: t.len, leakAfter: after,
               correct: a });
    process.stdout.write(n.verdict === "leak" ? (after < 15 ? "." : "x") : "-");
  } catch (e) {
    fail++;
    console.log(`\n  ✗ ${r.settingname}-${t.i}: ${String(e).slice(0, 70)}`);
  }
}
console.log();
writeFileSync(OUT, JSON.stringify(out, null, 1));
const fixed = out.filter((o) => o.verdict === "leak" && o.leakAfter < 15).length;
const remain = out.filter((o) => o.verdict === "leak" && o.leakAfter >= 15).length;
console.log(`판정: 유출 ${leak}건 / 정상(keep) ${keep}건 / 실패 ${fail}건`);
console.log(`유출 중 해소 ${fixed}건, 미해소 ${remain}건 → ${OUT}`);
