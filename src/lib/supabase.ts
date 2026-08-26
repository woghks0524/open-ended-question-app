import { createClient, SupabaseClient } from "@supabase/supabase-js";

// 서버 전용 Supabase 클라이언트.
// service_role 키를 쓰므로 절대 클라이언트 컴포넌트에서 import하면 안 된다.
// (API 라우트·서버 코드에서만 사용)
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 환경변수가 설정되지 않았습니다.");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}
