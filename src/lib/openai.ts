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
  vectorStoreIds = [],
  unitKey,
  model = "gpt-4o",
}: {
  instructions: string;
  input: string;
  /** 검색 대상 벡터스토어들. [단원 라이브러리, (선택)평가별 교사 보관함] */
  vectorStoreIds?: (string | undefined)[];
  /** 단원 attribute 필터값. 라이브러리·교사파일 모두 이 key로 태그됨 → 해당 단원만 검색 */
  unitKey?: string;
  model?: string;
}): Promise<string> {
  const client = getOpenAIClient();

  const ids = vectorStoreIds.filter((v): v is string => Boolean(v));
  const tools = ids.length
    ? [
        {
          type: "file_search" as const,
          vector_store_ids: ids,
          ...(unitKey
            ? { filters: { key: "key", type: "eq" as const, value: unitKey } }
            : {}),
        },
      ]
    : [];

  const resp = await client.responses.create({
    model,
    instructions,
    input,
    temperature: 0.01,
    top_p: 0.01,
    ...(tools.length ? { tools } : {}),
  });

  return (resp.output_text || "").trim();
}
