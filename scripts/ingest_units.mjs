// scripts/units.json → OpenAI 벡터스토어 적재. 단원별 1파일 + attributes 태그.
// 실행: node --env-file=.env.local scripts/ingest_units.mjs
import OpenAI from "openai";
import { toFile } from "openai";
import { readFileSync, writeFileSync } from "node:fs";

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
const client = new OpenAI({ apiKey: keys[0] });

const { records } = JSON.parse(readFileSync(new URL("./units.json", import.meta.url)));
console.log(`적재 대상 단원: ${records.length}`);

// 벡터스토어 생성
const vs = await client.vectorStores.create({ name: "교과서 단원 라이브러리 (국수사과)" });
console.log(`벡터스토어 생성: ${vs.id}`);

function unitText(r) {
  return `과목: ${r.subject}
학년/학기: ${r.grade}학년 ${r.semester}학기
출판사: ${r.publisher}
단원: ${r.unitRaw}
영역: ${r.domain}
성취기준: ${r.standard}

[단원 학습 내용]
${r.content}`;
}

let done = 0, failed = 0;
const CONCURRENCY = 6;
async function worker(slice) {
  for (const [i, r] of slice) {
    try {
      const file = await client.files.create({
        file: await toFile(Buffer.from(unitText(r), "utf-8"), `unit_${i}.txt`),
        purpose: "assistants",
      });
      await client.vectorStores.files.create(vs.id, {
        file_id: file.id,
        attributes: {
          subject: r.subject,
          grade: r.grade,
          semester: r.semester,
          publisher: r.publisher,
          unit: r.unitRaw,
          domain: r.domain || "",
          key: r.key,
        },
      });
      done++;
    } catch (e) {
      failed++;
      console.log(`  ❌ [${i}] ${r.key}: ${e.status || ""} ${e.message}`);
    }
    if ((done + failed) % 30 === 0) console.log(`  …${done + failed}/${records.length} (성공 ${done}, 실패 ${failed})`);
  }
}
const indexed = records.map((r, i) => [i, r]);
const slices = Array.from({ length: CONCURRENCY }, (_, k) => indexed.filter((_, idx) => idx % CONCURRENCY === k));
await Promise.all(slices.map(worker));
console.log(`업로드 완료: 성공 ${done}, 실패 ${failed}`);

// 처리 완료까지 폴링
process.stdout.write("처리 대기");
for (let t = 0; t < 60; t++) {
  const cur = await client.vectorStores.retrieve(vs.id);
  const c = cur.file_counts;
  process.stdout.write(`\r처리: completed ${c.completed}, in_progress ${c.in_progress}, failed ${c.failed}   `);
  if (c.in_progress === 0) break;
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("");

writeFileSync(new URL("./library-vs.json", import.meta.url), JSON.stringify({ vectorStoreId: vs.id }, null, 2));
console.log(`\n💾 저장: scripts/library-vs.json → ${vs.id}`);
