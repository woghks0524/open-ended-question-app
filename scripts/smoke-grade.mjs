// 스모크 테스트: Responses API + file_search 채점이 실제로 도는지 확인.
// 실행: node --env-file=.env.local scripts/smoke-grade.mjs
import OpenAI from "openai";

const keys = (process.env.OPENAI_API_KEYS || "").split(",").map((s) => s.trim()).filter(Boolean);
const vectorStoreId = process.env.VECTORSTORE_GRADE4_SCIENCE_CHUNJAE; // 4학년 과학(천재)
const client = new OpenAI({ apiKey: keys[0] });

const input = `다음 학생 답안을 채점하고 5문단 형식으로 피드백해줘.
평가 주의 사항: (없음)
문항: 물이 얼음으로 변할 때 부피는 어떻게 변하는지 쓰시오.
학생 답안: 물이 얼면 부피가 늘어난다.`;

console.log(`▶ vectorStore=${vectorStoreId}  key=...${keys[0]?.slice(-6)}`);
const t0 = Date.now();
const resp = await client.responses.create({
  model: "gpt-4o",
  instructions:
    "너는 초등 서술형 채점 도우미야. 반드시 file search로 벡터스토어를 검색해 근거를 찾고, 4/3/2/1점 중 하나로 채점한 뒤 쉬운 말로 피드백해. 출처는 <파일명> N쪽 형식으로.",
  input,
  temperature: 0.01,
  top_p: 0.01,
  tools: [{ type: "file_search", vector_store_ids: [vectorStoreId] }],
});

console.log(`✅ 응답 도착 (${((Date.now() - t0) / 1000).toFixed(1)}s)\n`);
console.log(resp.output_text);
// file_search가 실제로 호출됐는지 확인
const usedFileSearch = (resp.output || []).some((o) => o.type === "file_search_call");
console.log(`\n— file_search 호출됨? ${usedFileSearch ? "예 ✅" : "아니오 ⚠️"}`);
