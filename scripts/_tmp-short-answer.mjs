// [임시] 단답형 문항 채점 진단. 확인 후 삭제.
// 물음: 모범답안이 짧은(단어·나열형) 문항에서, 교사 모범답안을 그대로 낸 학생이 만점을 받는가?
// 만점이 안 나오면 학생은 아무리 잘해도 4점을 받을 수 없다.
import OpenAI from "openai";
import { readFileSync } from "node:fs";
for (const l of readFileSync(".env.local", "utf-8").split("\n")) {
  const m = l.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
}
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEYS.split(",")[0].trim() });
const INS = readFileSync("src/lib/instructions.ts", "utf-8")
  .match(/export const STUDENT_INSTRUCTIONS = `([\s\S]*?)`;/)[1];

const files = ["thinking-class-rows.json", "thinking-class-rows-g3.json", "thinking-class-rows-g4.json",
  "thinking-class-rows-g5.json", "thinking-class-rows-g6.json"];
let rows = [];
for (const f of files) rows = rows.concat(JSON.parse(readFileSync(`scripts/${f}`, "utf-8")));

const score = (t) => {
  const l = t.match(/채점\s*결과\s*[:：]\s*([^\n]*)/);
  if (!l) return null;
  const m = l[1].replace(/^[(\s]+/, "").match(/^([^()\-–,·\n]{1,12}?)\s*(?:[()\-–,·]|$)/);
  return m?.[1].trim() || null;
};

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
  return { s: score(t), reason: ((t.match(/채점\s*결과[^\n]*/) || [""])[0] || "").replace(/^.*?-\s*/, "").slice(0, 90) };
}

// 단답형(모범답안 40자 미만) 표본 + 대조군(모범답안 100자 이상) 표본
const short = [
  ["생각교실6사15", 1], ["생각교실4사01", 1], ["생각교실6과03", 1],
  ["생각교실3수02", 1], ["생각교실6사04", 1], ["생각교실5국03", 1],
];
const long = [["생각교실6사14", 1], ["생각교실3사10", 3]];

console.log("■ 단답형 문항 — 교사 모범답안을 그대로 제출");
let full = 0;
for (const [code, slot] of short) {
  const r = rows.find((x) => x.settingname === code);
  const ans = r[`correctanswer${slot}`];
  const { s, reason } = await grade(r, slot, ans);
  if (/4/.test(s || "")) full++;
  console.log(`${/4/.test(s || "") ? "✅" : "❌"} ${code}-${slot} [${r.grade}학년 ${r.subject}] 모범답안 "${ans.slice(0, 24)}" → ${s}`);
  if (!/4/.test(s || "")) console.log(`     이유: ${reason}`);
}
console.log(`\n단답형 만점 비율: ${full}/${short.length}`);

console.log("\n■ 대조군 (서술형, 모범답안 100자 이상)");
let full2 = 0;
for (const [code, slot] of long) {
  const r = rows.find((x) => x.settingname === code);
  const { s } = await grade(r, slot, r[`correctanswer${slot}`]);
  if (/4/.test(s || "")) full2++;
  console.log(`${/4/.test(s || "") ? "✅" : "❌"} ${code}-${slot} [${r.grade}학년 ${r.subject}] → ${s}`);
}
console.log(`\n서술형 만점 비율: ${full2}/${long.length}`);
