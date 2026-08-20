// 5·6학년 2학기 16권 → 기존 지도서 라이브러리(LIBRARY_VECTORSTORE_ID)에 추가.
// 6월 적재(ingest_pdfs.mjs)와 동일한 파일 형식·attributes 규격을 따른다.
import OpenAI from "openai";
import { toFile } from "openai";
import { readFileSync } from "node:fs";

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
const client = new OpenAI({ apiKey: keys[0] });
const VS = process.env.LIBRARY_VECTORSTORE_ID;

const manifest = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-jawoon-dev-open-ended-question-app/dbf26737-b17f-41b8-9213-b5b0dbe25fb4/scratchpad/g56s2_txt/manifest.json"))
  .filter((m) => m.txt); // 메뉴 전용 항목 제외

// 이미 적재된 bookKey는 건너뜀 (재실행 안전)
const existing = new Set();
for await (const f of client.vectorStores.files.list(VS, { limit: 100 })) {
  if (f.attributes?.bookKey) existing.add(f.attributes.bookKey);
}

let done = 0, skipped = 0, failed = 0;
for (const m of manifest) {
  if (existing.has(m.bookKey)) { console.log(`  ↷ 이미 있음: ${m.bookKey}`); skipped++; continue; }
  try {
    const text = readFileSync(m.txt, "utf-8");
    const header = `[교과서] ${m.subject} ${m.grade}학년 ${m.semester}학기 · ${m.publisher} (지도서 원문)\n\n`;
    const file = await client.files.create({
      file: await toFile(Buffer.from(header + text, "utf-8"), `${m.bookKey.replace(/[|/]/g, "_")}.txt`),
      purpose: "assistants",
    });
    await client.vectorStores.files.create(VS, {
      file_id: file.id,
      attributes: { subject: m.subject, grade: m.grade, semester: m.semester, publisher: m.publisher, bookKey: m.bookKey },
    });
    done++;
    console.log(`  ✅ ${m.bookKey} (${m.chars.toLocaleString()}자)`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${m.bookKey}: ${e.status || ""} ${e.message}`);
  }
}
console.log(`\n적재: 성공 ${done} / 건너뜀 ${skipped} / 실패 ${failed}`);

// 인덱싱 완료 대기
for (let t = 0; t < 60; t++) {
  const cur = await client.vectorStores.retrieve(VS);
  const c = cur.file_counts;
  if (c.in_progress === 0) {
    console.log(`인덱싱 완료: 총 ${c.completed}권 (실패 ${c.failed})`);
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 5000));
}
console.log("⚠️ 인덱싱 대기 시간 초과 — 잠시 후 상태 재확인 필요");
