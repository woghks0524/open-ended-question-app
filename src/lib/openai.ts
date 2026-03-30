import OpenAI from "openai";

let clientInstance: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (clientInstance) return clientInstance;

  const keys = process.env.OPENAI_API_KEYS?.split(",") || [];
  if (keys.length === 0) throw new Error("No OpenAI API keys configured");

  const randomKey = keys[Math.floor(Math.random() * keys.length)];
  clientInstance = new OpenAI({ apiKey: randomKey });
  return clientInstance;
}

export async function createThread(): Promise<string> {
  const client = getOpenAIClient();
  const thread = await client.beta.threads.create();
  return thread.id;
}

export async function runAssistantAndWait(
  threadId: string,
  assistantId: string,
  userMessage: string
): Promise<string> {
  const client = getOpenAIClient();

  await client.beta.threads.messages.create(threadId, {
    role: "user",
    content: userMessage,
  });

  const run = await client.beta.threads.runs.create(threadId, {
    assistant_id: assistantId,
    temperature: 0.01,
    top_p: 0.01,
  });

  // Poll until completed
  let status = run.status;
  while (status !== "completed" && status !== "failed" && status !== "cancelled") {
    await new Promise((r) => setTimeout(r, 2000));
    const result = await client.beta.threads.runs.retrieve(run.id, { thread_id: threadId });
    status = result.status;
  }

  if (status !== "completed") {
    throw new Error(`Run ended with status: ${status}`);
  }

  const messages = await client.beta.threads.messages.list(threadId);
  const lastMessage = messages.data[0];
  if (lastMessage.content[0].type === "text") {
    return lastMessage.content[0].text.value.trim();
  }

  return "";
}
