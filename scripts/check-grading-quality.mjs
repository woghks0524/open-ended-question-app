// 채점 품질 측정 — 배포된 실제 서버로.
//
// 지금까지 잰 것은 "모범답안을 그대로 내면 만점이 나오는가"(천장)뿐이다.
// 이 스크립트는 수준별 변별을 잰다: 자리마다 3수준 답안을 만들어 실제
// 프로덕션 /api/grade로 채점하고, 기대 구간에 들어오는지 본다.
//   완벽(모범답안 그대로) → 만점이어야
//   부분(요소 하나 빠짐)   → 중간(2~3점대)이어야
//   오답/포기("잘 모르겠어요"류) → 최하여야
// 덤: 만점이 아닌 경우의 피드백에 모범답안이 통째로 새는지 검사
// (지침: 낮은 수준에는 모범답안 전체를 노출하지 않는다).
//
// 문항은 Supabase(정본)에서 읽는다. 로컬 thinking-class-rows JSON은 수리 이전
// 사본이라 쓰지 않는다 (2026-08-28에 이걸로 한 번 데였다).
//
// 실행: node scripts/check-grading-quality.mjs [--per-group N] [--concurrency N]
// 결과: 콘솔 요약 + 스크래치 JSON(경로는 끝에 출력)

import OpenAI from "openai";
import { readFileSync, writeFileSync } from "node:fs";

for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const argv = process.argv.slice(2);
const argOf = (n, d) => { const i = argv.indexOf(n); return i >= 0 ? parseInt(argv[i + 1]) : d; };
const PER_GROUP = argOf("--per-group", 12);
const CONCURRENCY = argOf("--concurrency", 6);
const PROD = process.env.QUALITY_TARGET || "https://test4school.vercel.app";
const OUT = process.env.QUALITY_OUT || "/tmp/grading-quality.json";

const U = process.env.SUPABASE_URL, K = process.env.SUPABASE_SERVICE_ROLE_KEY;
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEYS.split(",")[0].trim() });

// ── 표본 뽑기 ──────────────────────────────────────────────────────
const rows = await (await fetch(`${U}/rest/v1/assessments?select=*&limit=3000`,
  { headers: { apikey: K, Authorization: `Bearer ${K}` } })).json();

// 알려진 모범답안 결함 자리는 뺀다 — 채점기 품질과 데이터 결함을 섞지 않기 위해
let defects = new Set();
try {
  for (const d of JSON.parse(readFileSync("scripts/model-answer-defects.json", "utf-8")))
    defects.add(`${d.code}-${d.slot}`);
} catch {}

const slots = [];
for (const r of rows) {
  for (const i of [1, 2, 3]) {
    const q = (r[`question${i}`] || "").trim();
    const a = (r[`correctanswer${i}`] || "").trim();
    if (!q || !a) continue;
    if (defects.has(`${r.settingname}-${i}`)) continue;
    slots.push({ code: r.settingname, slot: i, grade: r.grade, subject: r.subject,
                 question: q, answer: a, scale: r.feedbackinstruction || "",
                 group: r.settingname.startsWith("생각교실") ? "생각교실" : "교사제작" });
  }
}
const hash = (s) => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };
// 학년·과목 버킷을 돌아가며 하나씩 뽑는다. 해시 정렬만 쓰면 코드 접두어가 비슷한
// 것끼리 몰려 표본이 한 과목에 쏠린다 (첫 실행에서 12자리 전부 3학년 과학이 나왔다).
const pick = (g) => {
  const buckets = new Map();
  for (const s of slots.filter((s) => s.group === g)) {
    const k = `${s.grade}|${s.subject}`;
    if (!buckets.has(k)) buckets.set(k, []);
    buckets.get(k).push(s);
  }
  for (const v of buckets.values()) v.sort((a, b) => hash(a.code + a.slot) - hash(b.code + b.slot));
  const keys = [...buckets.keys()].sort();
  const out = [];
  for (let round = 0; out.length < PER_GROUP; round++) {
    let added = false;
    for (const k of keys) {
      const v = buckets.get(k);
      if (round < v.length && out.length < PER_GROUP) { out.push(v[round]); added = true; }
    }
    if (!added) break;
  }
  return out;
};
const sample = [...pick("생각교실"), ...pick("교사제작")];
console.log(`▶ 표본: 생각교실 ${pick("생각교실").length} + 교사제작 ${pick("교사제작").length}자리, 자리당 3수준 = ${sample.length * 3}회 채점 (대상: ${PROD})\n`);

// ── 수준별 답안 생성 ───────────────────────────────────────────────
// 부분 답안은 '요소 뺄셈'으로 만든다. "요소 하나를 빼라"고만 하면 요구가 1개뿐인
// 문항에서 사실상 완전한 답이 나와, 4점이 옳은 채점인데 실패로 집계됐다
// (실측: 부분→4점 43% 중 상당수가 이 허수). 요소 목록을 먼저 세우게 하고,
// 뺀 요소를 이름으로 기록해 부실함이 구조적으로 보장되게 한다.
const GEN_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    elements: { type: "array", items: { type: "string" }, description: "문항·모범답안이 요구하는 요소 목록" },
    dropped: { type: "string", description: "partial에서 뺀 요소 (elements 중 하나)" },
    partial: { type: "string", description: "dropped 요소를 완전히 뺀, 나머지는 맞는 답. dropped 내용을 암시도 하지 않음" },
    wrong: { type: "string", description: "핵심을 놓친 짧은 오답 또는 회피성 답" },
  },
  required: ["elements", "dropped", "partial", "wrong"],
};
async function makeAnswers(s) {
  const res = await client.responses.create({
    model: "gpt-4o", temperature: 0.3,
    instructions: `초등 ${s.grade}학년 학생 답안을 시뮬레이션합니다.
1) 문항과 모범답안이 요구하는 요소를 목록(elements)으로 세세요. 요소가 하나뿐인 문항이면 그 요소를 절반으로 쪼개세요 (예: "정의를 설명" → ①핵심 개념 ②구체 설명).
2) dropped: elements 중 하나를 고르세요.
3) partial: dropped를 완전히 뺀 답. 나머지 요소는 그 학년 아이 말투로 맞게 씁니다. dropped의 내용은 한 글자도 들어가면 안 됩니다.
4) wrong: 핵심을 놓친 짧은 오답.
모범답안을 그대로 베끼지 마세요.`,
    input: `문항: ${s.question}\n\n모범답안: ${s.answer}`,
    text: { format: { type: "json_schema", name: "answers", strict: true, schema: GEN_SCHEMA } },
  });
  return JSON.parse(res.output_text);
}

// ── 프로덕션 채점 ──────────────────────────────────────────────────
async function gradeProd(code, slot, answer) {
  const answers = [null, null, null]; answers[slot - 1] = answer;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 + Math.random() * 2000));
    try {
      const res = await fetch(`${PROD}/api/grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, answers }),
        signal: AbortSignal.timeout(90_000),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || res.status);
      return d.feedbacks[slot - 1];
    } catch (e) { if (attempt === 1) return { feedback: `[요청 실패: ${String(e).slice(0, 60)}]`, score: null }; }
  }
}

// ── 판정 ───────────────────────────────────────────────────────────
const isFull = (s) => /4|매우\s*우수|^상$|능숙|도달/.test(s || "");
const isLow  = (s) => /1|노력|^하$|미도달|도움/.test(s || "");
const norm = (t) => (t || "").replace(/\s+/g, "");
// 배포된 가드(grade/route.ts hasAnswerLeak)와 같은 기준: 3문단 이후만 보고,
// 문항·학생 답안에 이미 있는 구절은 유출로 세지 않는다. 1·2문단은 원문 echo라
// 학생이 정답에 가까울수록 가짜 유출이 잡힌다 (실측 오인 7건 중 6건).
function leaked(feedback, modelAnswer, question, studentAnswer) {
  const cut = (feedback || "").search(/채점\s*결과/);
  const body = cut >= 0 ? feedback.slice(cut) : (feedback || "");
  const f = norm(body), a = norm(modelAnswer), q = norm(question), s = norm(studentAnswer);
  if (a.length < 10) return false;
  const win = Math.min(12, a.length);
  for (let i = 0; i + win <= a.length; i += 4) {
    const c = a.slice(i, i + win);
    if (f.includes(c) && !q.includes(c) && !s.includes(c)) return true;
  }
  return false;
}

const results = [];
let done = 0;
const queue = [...sample];
await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
  while (queue.length) {
    const s = queue.shift();
    try {
      const gen = await makeAnswers(s);
      const [perfect, partial, wrong] = await Promise.all([
        gradeProd(s.code, s.slot, s.answer),
        gradeProd(s.code, s.slot, gen.partial),
        gradeProd(s.code, s.slot, gen.wrong),
      ]);
      results.push({ ...s, gen,
        perfect: { score: perfect.score, ok: isFull(perfect.score) },
        partial: { score: partial.score, ok: !isFull(partial.score) && !isLow(partial.score),
                   leak: leaked(partial.feedback, s.answer, s.question, gen.partial), feedback: partial.feedback },
        wrong:   { score: wrong.score, ok: isLow(wrong.score),
                   leak: leaked(wrong.feedback, s.answer, s.question, gen.wrong), feedback: wrong.feedback },
      });
    } catch (e) { results.push({ ...s, error: String(e).slice(0, 100) }); }
    if (++done % 4 === 0) console.log(`  ${done}/${sample.length}자리 …`);
  }
}));

writeFileSync(OUT, JSON.stringify(results, null, 1));

// ── 요약 ───────────────────────────────────────────────────────────
for (const g of ["생각교실", "교사제작"]) {
  const R = results.filter((r) => r.group === g && !r.error);
  if (!R.length) continue;
  const n = R.length;
  const c = (f) => R.filter(f).length;
  console.log(`\n═══ ${g} (${n}자리) ═══`);
  console.log(`  완벽 답안 → 만점        : ${c((r) => r.perfect.ok)}/${n}`);
  console.log(`  부분 답안 → 중간(2~3점대): ${c((r) => r.partial.ok)}/${n}`);
  console.log(`  오답      → 최하        : ${c((r) => r.wrong.ok)}/${n}`);
  console.log(`  낮은 점수 피드백에 모범답안 유출: ${c((r) => r.partial.leak || r.wrong.leak)}건`);
  console.log(`  점수 추출 실패: ${c((r) => !r.perfect.score || !r.partial.score || !r.wrong.score)}건`);
  const miss = R.filter((r) => !r.perfect.ok || !r.partial.ok || !r.wrong.ok);
  for (const r of miss) {
    const bits = [];
    if (!r.perfect.ok) bits.push(`완벽→${r.perfect.score}`);
    if (!r.partial.ok) bits.push(`부분→${r.partial.score}`);
    if (!r.wrong.ok) bits.push(`오답→${r.wrong.score}`);
    console.log(`    · ${r.code} 슬롯${r.slot} [${r.grade}학년 ${r.subject}] ${bits.join(", ")}`);
  }
}
const errs = results.filter((r) => r.error);
if (errs.length) console.log(`\n⚠ 오류 ${errs.length}건: ${errs.map((e) => e.code + "-" + e.slot).join(", ")}`);
console.log(`\n상세: ${OUT}`);
