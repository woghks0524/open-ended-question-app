import { GoogleSpreadsheet } from "google-spreadsheet";
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

export async function saveResults(sheetUrl: string, rowData: string[]) {
  const auth = getAuth();

  // Extract spreadsheet ID from URL
  const match = sheetUrl.match(/\/d\/([a-zA-Z0-9-_]+)/);
  if (!match) throw new Error("Invalid Google Sheets URL");

  const doc = new GoogleSpreadsheet(match[1], auth);
  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  await sheet.addRow(rowData);
}
