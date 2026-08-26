// 구글 시트(마스터 문항 시트) → Supabase assessments 테이블 이사 스크립트
//
// 사용법:
//   1. supabase/schema.sql을 Supabase SQL Editor에서 실행해 테이블을 먼저 만든다
//   2. .env.local에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY가 있는지 확인
//      (기존 GCP_CREDENTIALS, GOOGLE_SHEET_NAME도 필요)
//   3. node scripts/migrate-sheet-to-supabase.mjs
//
// 같은 코드(settingname)가 이미 테이블에 있으면 건너뛰므로 여러 번 실행해도 안전하다.

import { readFileSync, existsSync } from "node:fs";
import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { google } from "googleapis";
import { createClient } from "@supabase/supabase-js";

// .env.local 로드 (dotenv 없이)
const envPath = new URL("../.env.local", import.meta.url);
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

const required = ["GCP_CREDENTIALS", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`환경변수 ${k}가 없습니다. .env.local을 확인하세요.`);
    process.exit(1);
  }
}

const COLUMNS = [
  "settingname",
  "question1", "question2", "question3",
  "image1", "image2", "image3",
  "correctanswer1", "correctanswer2", "correctanswer3",
  "feedbackinstruction",
  "unitkey", "grade", "semester", "subject", "publisher", "unit",
  "vectorapi", "sheeturl", "timestamp",
];

// 1) 시트 읽기
const credentials = JSON.parse(process.env.GCP_CREDENTIALS);
const auth = new JWT({
  email: credentials.client_email,
  key: credentials.private_key,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive",
  ],
});

const sheetName = process.env.GOOGLE_SHEET_NAME || "서술형 평가 문항";
const drive = google.drive({ version: "v3", auth });
const found = await drive.files.list({
  q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
  fields: "files(id)",
});
const fileId = found.data.files?.[0]?.id;
if (!fileId) {
  console.error(`시트 "${sheetName}"을 찾지 못했습니다.`);
  process.exit(1);
}

const doc = new GoogleSpreadsheet(fileId, auth);
await doc.loadInfo();
const sheet = doc.sheetsByIndex[0];
const rows = await sheet.getRows();
console.log(`시트에서 ${rows.length}행을 읽었습니다.`);

// 2) Supabase에 넣기
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: existing, error: listErr } = await supabase
  .from("assessments")
  .select("settingname");
if (listErr) {
  console.error("기존 데이터 조회 실패:", listErr.message);
  process.exit(1);
}
const existingCodes = new Set((existing ?? []).map((r) => r.settingname));

let inserted = 0, skipped = 0, failed = 0;
for (const row of rows) {
  const code = row.get("settingname");
  if (!code) { skipped++; continue; }               // 코드 없는 행은 건너뜀
  if (existingCodes.has(code)) { skipped++; continue; }

  const record = {};
  for (const c of COLUMNS) record[c] = row.get(c) || "";

  const { error } = await supabase.from("assessments").insert(record);
  if (error) {
    console.error(`실패: ${code} — ${error.message}`);
    failed++;
  } else {
    inserted++;
  }
}

console.log(`완료 — 새로 넣음 ${inserted}건, 건너뜀(중복·빈코드) ${skipped}건, 실패 ${failed}건`);
