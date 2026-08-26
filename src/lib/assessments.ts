import { getSupabase } from "@/lib/supabase";

// 문항 저장·조회 (Supabase).
// 원래 구글 시트(google-sheets.ts)에 저장했지만, 시트 API의 분당 쿼터 때문에
// 50명 동시 접속 시 문항 조회가 무더기로 실패해 DB로 옮겼다.
// 함수 이름·반환 형태는 시트 버전과 동일하게 유지해 라우트 쪽 변경을 최소화했다.
// (학생 결과 저장은 여전히 교사 개인 시트에 쓴다 — google-sheets.ts의 saveResults)

// 시트 시절 반환 형태(Record<string, string>)를 유지하기 위해
// id/created_at 같은 비문자열 컬럼을 문자열로 정리한다.
function toRecord(row: Record<string, unknown>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(row)) {
    if (k === "id") continue;
    o[k] = v == null ? "" : String(v);
  }
  return o;
}

export async function lookupAssessment(code: string): Promise<Record<string, string> | null> {
  const { data, error } = await getSupabase()
    .from("assessments")
    .select("*")
    .eq("settingname", code)
    .maybeSingle();
  if (error) throw error;
  return data ? toRecord(data) : null;
}

export async function isCodeDuplicate(code: string): Promise<boolean> {
  const { count, error } = await getSupabase()
    .from("assessments")
    .select("id", { count: "exact", head: true })
    .eq("settingname", code);
  if (error) throw error;
  return (count ?? 0) > 0;
}

// 테이블에 없는 키가 섞여 들어오면 insert 전체가 실패하므로 아는 컬럼만 골라 넣는다
const COLUMNS = [
  "settingname",
  "question1", "question2", "question3",
  "image1", "image2", "image3",
  "correctanswer1", "correctanswer2", "correctanswer3",
  "feedbackinstruction",
  "unitkey", "grade", "semester", "subject", "publisher", "unit",
  "vectorapi", "sheeturl", "timestamp",
] as const;

export async function saveAssessment(data: Record<string, string>) {
  const row: Record<string, string> = {};
  for (const c of COLUMNS) {
    if (data[c] !== undefined) row[c] = data[c];
  }
  const { error } = await getSupabase().from("assessments").insert(row);
  if (error) throw error;
}

// 교사용 문항 목록.
// 모범답안·채점지침·결과시트 URL 등 민감 컬럼은 목록에 내려보내지 않는다.
export async function listAssessments(): Promise<Record<string, string>[]> {
  const { data, error } = await getSupabase()
    .from("assessments")
    .select("settingname, question1, question2, question3, subject, grade, semester, publisher, unit, timestamp, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toRecord);
}
