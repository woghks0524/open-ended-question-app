import OpenAI from "openai";
import { readFileSync } from "node:fs";
const c = new OpenAI({ apiKey: (process.env.OPENAI_API_KEYS||"").split(",")[0].trim() });
const vs = JSON.parse(readFileSync(new URL("./library-pdf-vs.json", import.meta.url))).vectorStoreId;
for (let t=0; t<240; t++) {
  const cur = await c.vectorStores.retrieve(vs);
  const f = cur.file_counts;
  if (t % 4 === 0) console.log(`[${t*15}s] completed ${f.completed}, in_progress ${f.in_progress}, failed ${f.failed}`);
  if (f.in_progress === 0) { console.log(`DONE completed ${f.completed}, failed ${f.failed}`); break; }
  await new Promise(r=>setTimeout(r,15000));
}
