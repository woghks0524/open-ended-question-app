import OpenAI from "openai";

// ── 키 분산 ────────────────────────────────────────────────────────
// 키를 여러 개 두는 이유는 분당 한도를 나눠 쓰기 위해서다. 그런데 예전 코드는
// 인스턴스당 한 번 랜덤으로 고른 클라이언트를 그대로 붙들고 있어서, 25명을
// 받아내는 뜨거운 인스턴스가 키 하나만 계속 두드렸다 — 분산이 사실상 없었다.
// 호출마다 다음 키로 넘긴다. 시작점만 인스턴스별로 흩어 놓아, 갓 뜬 인스턴스들이
// 다 같이 첫 번째 키부터 시작하는 일을 막는다.
const clients = new Map<string, OpenAI>();
let cursor = -1;

function apiKeys(): string[] {
  const keys = process.env.OPENAI_API_KEYS?.split(",").map((k) => k.trim()).filter(Boolean) || [];
  if (keys.length === 0) throw new Error("No OpenAI API keys configured");
  return keys;
}

export function getOpenAIClient(): OpenAI {
  const keys = apiKeys();
  if (cursor < 0) cursor = Math.floor(Math.random() * keys.length);
  const key = keys[cursor++ % keys.length];

  let client = clients.get(key);
  if (!client) {
    client = new OpenAI({ apiKey: key });
    clients.set(key, client);
  }
  return client;
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
  bookKey,
  model = "gpt-4o",
}: {
  instructions: string;
  input: string;
  /** 검색 대상 벡터스토어들. [지도서 라이브러리, (선택)평가별 교사 보관함] */
  vectorStoreIds?: (string | undefined)[];
  /** 교과서 attribute 필터값(과목|학년|학기|출판사). 라이브러리·교사파일 모두 이 bookKey로
   *  태그됨 → 그 교과서(지도서)만 검색. 단원은 입력 프롬프트로 좁힌다. */
  bookKey?: string;
  model?: string;
}): Promise<string> {
  const ids = vectorStoreIds.filter((v): v is string => Boolean(v));
  const tools = ids.length
    ? [
        {
          type: "file_search" as const,
          vector_store_ids: ids,
          ...(bookKey
            ? { filters: { key: "bookKey", type: "eq" as const, value: bookKey } }
            : {}),
        },
      ]
    : [];

  // 25명이 동시에 채점을 누르면 분당 한도에 걸리는 호출이 나온다. 한 번만 다시
  // 시도하되, getOpenAIClient()가 커서를 넘겨 다음 키로 붙으므로 재시도는 대개
  // 다른 키로 나간다. 지터는 몰린 재시도가 또 같은 순간에 겹치지 않게 한다.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 800 + Math.floor(Math.random() * 1200)));
    try {
      const resp = await getOpenAIClient().responses.create({
        model,
        instructions,
        input,
        temperature: 0.01,
        top_p: 0.01,
        ...(tools.length ? { tools } : {}),
      });
      return (resp.output_text || "").trim();
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}
