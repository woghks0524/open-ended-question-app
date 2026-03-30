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
