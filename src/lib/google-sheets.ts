import { GoogleSpreadsheet, GoogleSpreadsheetWorksheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

// 학생 결과를 교사 개인 결과 시트에 저장하는 용도만 남았다.
// 문항 저장·조회는 Supabase로 이사했다 (lib/assessments.ts).
// 시트 시절의 문항 캐시·쿼터 대응 코드와 기존 문항 데이터 이사는
// scripts/migrate-sheet-to-supabase.mjs 및 git 히스토리 참고.

function getAuth(): JWT {
  const credentials = JSON.parse(process.env.GCP_CREDENTIALS || "{}");
  return new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets",
      "https://www.googleapis.com/auth/drive",
    ],
  });
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── 결과 시트 핸들 캐시 ────────────────────────────────────────────
// 학생 결과 저장은 수업이 끝나는 순간 25명이 동시에 누른다. 호출마다 loadInfo()를
// 하면 그 순간 읽기 요청이 25건 더 얹힌다. 문항은 Supabase로 옮겼지만 결과 저장은
// 여전히 교사 개인 시트라, 여기는 시트 쿼터가 그대로 살아 있다.
// 시트 구조는 바뀌지 않으므로 인스턴스당 한 번만 읽는다.
const resultSheets = new Map<string, GoogleSpreadsheetWorksheet>();

async function getResultSheet(spreadsheetId: string): Promise<GoogleSpreadsheetWorksheet> {
  const cached = resultSheets.get(spreadsheetId);
  if (cached) return cached;
  const doc = new GoogleSpreadsheet(spreadsheetId, getAuth());
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  resultSheets.set(spreadsheetId, sheet);
  return sheet;
}

export async function saveResults(sheetUrl: string, rowData: string[]) {
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL");
  const id = match[1];

  // 학생이 40분 수업 끝에 쓴 답안이라 한 번 실패하면 되돌릴 방법이 없다.
  // 쓰기 쿼터에 몰리는 순간을 넘기도록 지터를 주고 한 번 더 시도한다.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(700 + Math.floor(Math.random() * 1200));
    try {
      const sheet = await getResultSheet(id);
      await sheet.addRow(rowData);
      return;
    } catch (e) {
      lastErr = e;
      resultSheets.delete(id);   // 핸들이 상했을 수도 있으니 다음 시도는 새로 연다
    }
  }
  throw lastErr;
}
