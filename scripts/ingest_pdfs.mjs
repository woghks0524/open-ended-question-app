// 추출된 지도서 텍스트(/tmp/oeq_pdf_manifest.json) → 새 벡터스토어 적재.
// 교과서(권) 1개 = 1파일, attributes로 bookKey(과목|학년|학기|출판사) 태그.
// 실행: node --env-file=.env.local scripts/ingest_pdfs.mjs
import OpenAI from "openai";
import { toFile } from "openai";
import { readFileSync, writeFileSync } from "node:fs";

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
const client = new OpenAI({ apiKey: keys[0] });

const manifest = JSON.parse(readFileSync("/tmp/oeq_pdf_manifest.json", "utf-8"));
console.log(`적재 대상 교과서: ${manifest.length}권`);

const vs = await client.vectorStores.create({ name: "지도서 원문 라이브러리 (국수사과)" });
console.log(`벡터스토어 생성: ${vs.id}`);

let done = 0, failed = 0;
const CONC = 5;
async function worker(slice) {
  for (const m of slice) {
    try {
      const text = readFileSync(m.txt, "utf-8");
      const header = `[교과서] ${m.subject} ${m.grade}학년 ${m.semester}학기 · ${m.publisher} (지도서 원문)\n\n`;
      const file = await client.files.create({
        file: await toFile(Buffer.from(header + text, "utf-8"), `${m.bookKey.replace(/[|/]/g, "_")}.txt`),
        purpose: "assistants",
      });
      await client.vectorStores.files.create(vs.id, {
        file_id: file.id,
        attributes: {
          subject: m.subject, grade: m.grade, semester: m.semester,
          publisher: m.publisher, bookKey: m.bookKey,
        },
      });
      done++;
      console.log(`  ✅ ${m.bookKey} (${m.chars}자)`);
    } catch (e) {
      failed++;
      console.log(`  ❌ ${m.bookKey}: ${e.status || ""} ${e.message}`);
    }
  }
}
const slices = Array.from({ length: CONC }, (_, k) => manifest.filter((_, i) => i % CONC === k));
await Promise.all(slices.map(worker));
console.log(`업로드: 성공 ${done}, 실패 ${failed}`);

process.stdout.write("처리 대기");
for (let t = 0; t < 120; t++) {
  const cur = await client.vectorStores.retrieve(vs.id);
  const c = cur.file_counts;
  process.stdout.write(`\r처리: completed ${c.completed}, in_progress ${c.in_progress}, failed ${c.failed}   `);
  if (c.in_progress === 0) break;
  await new Promise((r) => setTimeout(r, 4000));
}
console.log("");
writeFileSync(new URL("./library-pdf-vs.json", import.meta.url), JSON.stringify({ vectorStoreId: vs.id }, null, 2));
console.log(`\n💾 저장: scripts/library-pdf-vs.json → ${vs.id}`);
