import OpenAI from "openai";

let clientInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (clientInstance) return clientInstance;

  const keys = process.env.OPENAI_API_KEYS?.split(",").map((k) => k.trim()).filter(Boolean) || [];
  if (keys.length === 0) throw new Error("No OpenAI API keys configured");

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  clientInstance = new OpenAI({ apiKey: randomKey });
  return clientInstance;
}

/**
 * Responses API로 채점/피드백을 1회 호출한다.
 * - 폐기 예정(2026-08-26)인 Assistants/Threads API 대신 사용.
 * - vectorStoreId를 요청마다 직접 넘기므로(file_search) 공유 Assistant를 갈아끼우던
 *   기존 방식의 동시성 문제가 사라진다.
 */
export async function gradeWithFiles({
  instructions,
  input,
  vectorStoreId,
  model = "gpt-4o",
}: {
  instructions: string;
  input: string;
  vectorStoreId?: string;
  model?: string;
}): Promise<string> {
  const client = getOpenAIClient();

  const resp = await client.responses.create({
    model,
    instructions,
    input,
    temperature: 0.01,
    top_p: 0.01,
    ...(vectorStoreId
      ? { tools: [{ type: "file_search" as const, vector_store_ids: [vectorStoreId] }] }
      : {}),
  });

  return (resp.output_text || "").trim();
}
