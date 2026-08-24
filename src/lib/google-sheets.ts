import { GoogleSpreadsheet, GoogleSpreadsheetRow } from "google-spreadsheet";
import { JWT } from "google-auth-library";

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

async function getQuestionSheet() {
  const auth = getAuth();
  const sheetName = process.env.GOOGLE_SHEET_NAME || "서술형 평가 문항";

  // Open by title - need to search through accessible sheets
  const { google } = await import("googleapis");
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
    fields: "files(id)",
  });

  const fileId = res.data.files?.[0]?.id;
  if (!fileId) throw new Error(`Sheet "${sheetName}" not found`);

  const doc = new GoogleSpreadsheet(fileId, auth);
  await doc.loadInfo();
  return doc.sheetsByIndex[0];
}

export async function lookupAssessment(code: string) {
  const sheet = await getQuestionSheet();
  const rows = await sheet.getRows();

  for (const row of rows) {
    if (row.get("settingname") === code) {
      const data: Record<string, string> = {};
      for (const header of sheet.headerValues) {
        data[header] = row.get(header) || "";
      }
      return data;
    }
  }
  return null;
}

// 만들어진 평가가 들어있는 마스터 시트의 웹 주소(공유용 링크).
export async function getQuestionSheetUrl(): Promise<string> {
  const auth = getAuth();
  const sheetName = process.env.GOOGLE_SHEET_NAME || "서술형 평가 문항";
  const { google } = await import("googleapis");
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
    fields: "files(id, webViewLink)",
  });
  const file = res.data.files?.[0];
  if (!file?.id) throw new Error(`Sheet "${sheetName}" not found`);
  return file.webViewLink || `https://docs.google.com/spreadsheets/d/${file.id}/edit`;
}

export async function isCodeDuplicate(code: string): Promise<boolean> {
  const sheet = await getQuestionSheet();
  const rows = await sheet.getRows();
  return rows.some((row: GoogleSpreadsheetRow) => row.get("settingname") === code);
}

export async function saveAssessment(data: Record<string, string>) {
  const sheet = await getQuestionSheet();
  await sheet.addRow(data);
}

/**
 * 기존 행의 특정 필드를 고친다. (문항 텍스트 수정 등)
 * addRow만 있던 탓에 등록된 문항을 고치려면 시트를 직접 여는 수밖에 없었다.
 * settingname으로 행을 찾고, 시트를 한 번만 읽어 여러 건을 이어서 처리한다.
 */
export async function updateAssessmentFields(
  updates: { code: string; field: string; value: string }[]
): Promise<{ code: string; field: string; status: string }[]> {
  const sheet = await getQuestionSheet();
  const rows = await sheet.getRows();
  const byCode = new Map(rows.map((r) => [r.get("settingname"), r]));
  const headers = new Set(sheet.headerValues);
  const result: { code: string; field: string; status: string }[] = [];

  for (const u of updates) {
    const row = byCode.get(u.code);
    if (!row) {
      result.push({ ...u, status: "행 없음" });
      continue;
    }
    if (!headers.has(u.field)) {
      // 헤더에 없는 컬럼은 조용히 버려지므로 미리 막는다
      result.push({ ...u, status: "컬럼 없음" });
      continue;
    }
    if (row.get(u.field) === u.value) {
      result.push({ ...u, status: "이미 동일" });
      continue;
    }
    row.set(u.field, u.value);
    await row.save();
    result.push({ ...u, status: "수정됨" });
    // 시트 쓰기 API 분당 쿼터 회피
    await new Promise((r) => setTimeout(r, 1200));
  }
  return result;
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
