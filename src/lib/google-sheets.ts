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

// 만들어진 평가 전체 목록(공유용). 학생 답안 등 민감정보는 없고 문항 메타만 반환.
export async function listAssessments() {
  const sheet = await getQuestionSheet();
  const rows = await sheet.getRows();
  const pick = (r: GoogleSpreadsheetRow, k: string) => r.get(k) || "";
  return rows
    .map((r) => ({
      code: pick(r, "settingname"),
      grade: pick(r, "grade"),
      semester: pick(r, "semester"),
      subject: pick(r, "subject"),
      publisher: pick(r, "publisher"),
      unit: pick(r, "unit"),
      questions: [pick(r, "question1"), pick(r, "question2"), pick(r, "question3")].filter(Boolean),
      timestamp: pick(r, "timestamp"),
    }))
    .filter((a) => a.code);
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
