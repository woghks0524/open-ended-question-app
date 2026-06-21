// 일회용 도구: 폐기 예정인 어시스턴트들의 채점 "지침(instructions)"을 추출해 저장한다.
// 실행: node --env-file=.env.local scripts/extract-instructions.mjs
// 결과: scripts/instructions-dump.json (지침/모델/도구), 이후 config.ts로 옮길 원본.
import OpenAI from "openai";
import { writeFileSync } from "node:fs";

// 환경변수에서 ASSISTANT_* 전부 수집 → { 라벨: assistantId }
const assistants = Object.entries(process.env)
  .filter(([k, v]) => k.startsWith("ASSISTANT_") && v)
  .map(([k, v]) => ({ label: k.replace(/^ASSISTANT_/, "").toLowerCase(), id: v }));

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
if (!keys.length) throw new Error("OPENAI_API_KEYS 없음");
if (!assistants.length) throw new Error("ASSISTANT_* 없음");

// 작동하는 키 하나 찾기
let client = null;
for (const key of keys) {
  const c = new OpenAI({ apiKey: key });
  try {
    await c.models.list();
    client = c;
    console.log(`✅ 사용 키: ...${key.slice(-6)}`);
    break;
  } catch {
    console.log(`⛔ 무효 키: ...${key.slice(-6)}`);
  }
}
if (!client) throw new Error("작동하는 OpenAI 키가 없음");

const out = {};
for (const { label, id } of assistants) {
  try {
    const a = await client.beta.assistants.retrieve(id);
    out[label] = {
      id,
      name: a.name,
      model: a.model,
      tools: (a.tools || []).map((t) => t.type),
      temperature: a.temperature,
      top_p: a.top_p,
      instructions: a.instructions || "",
    };
    const len = (a.instructions || "").length;
    console.log(`📄 ${label.padEnd(34)} model=${String(a.model).padEnd(14)} 지침 ${len}자  도구=${out[label].tools.join(",")}`);
  } catch (e) {
    console.log(`❌ ${label}: ${e.status || ""} ${e.message}`);
    out[label] = { id, error: e.message };
  }
}

writeFileSync(new URL("./instructions-dump.json", import.meta.url), JSON.stringify(out, null, 2));
const ok = Object.values(out).filter((v) => v.instructions !== undefined && !v.error).length;
console.log(`\n💾 저장: scripts/instructions-dump.json  (성공 ${ok}/${assistants.length})`);
