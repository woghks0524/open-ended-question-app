import { GoogleSpreadsheet } from "google-spreadsheet";
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

// ── 시트 파일 ID 캐시 ───────────────────────────────────────────────
// Drive 검색은 요청마다 할 필요가 없다. 시트 이름이 바뀌는 일은 사실상 없다.
let fileIdCache: string | null = null;

async function getFileId(auth: JWT): Promise<string> {
  if (fileIdCache) return fileIdCache;
  const sheetName = process.env.GOOGLE_SHEET_NAME || "서술형 평가 문항";
  const { google } = await import("googleapis");
  const drive = google.drive({ version: "v3", auth });
  const res = await drive.files.list({
    q: `name='${sheetName}' and mimeType='application/vnd.google-apps.spreadsheet'`,
    fields: "files(id)",
  });
  const id = res.data.files?.[0]?.id;
  if (!id) throw new Error(`Sheet "${sheetName}" not found`);
  fileIdCache = id;
  return id;
}

async function getQuestionSheet() {
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(await getFileId(auth), auth);
  await doc.loadInfo();
  return doc.sheetsByIndex[0];
}

// ── 문항 목록 캐시 ─────────────────────────────────────────────────
// 25명이 수업 시작에 동시에 들어오면 요청마다 Drive 검색 + loadInfo + getRows가
// 돌아 시트 API 쿼터를 넘긴다. 실측(2026-08-25): 25명 동시 요청 시 중앙 3.7초,
// 곧이어 재요청하면 20/25가 500. 단독 요청까지 실패하고 1분쯤 지나야 회복됐다.
//
// 그래서 세 가지를 건다.
//   (1) TTL 캐시 — 60초. 교사가 수업 중 문항을 고치는 일은 드물고 60초면 반영된다.
//   (2) 동시 요청 합치기 — 캐시가 비어 있을 때 25개 요청이 각자 시트를 읽지 않도록
//       진행 중인 로드 하나를 공유한다. 이게 없으면 캐시가 있어도 첫 순간에 터진다.
//   (3) 실패 시 이전 데이터 제공 — 시트가 쿼터로 막혀도 수업이 멈추지 않도록,
//       만료된 캐시라도 있으면 그것을 쓴다.
// TTL이 3분인 이유: 캐시는 인스턴스마다 따로 산다. 서버리스라 트래픽이 몰리면
// 새 인스턴스가 계속 뜨고, 갓 뜬 인스턴스는 캐시가 비어 있어 각자 시트를 읽는다.
// TTL이 짧을수록 그 재로드가 잦아져 쿼터에 걸린다. 교사가 시트를 직접 고쳐도
// 3분이면 반영되고, 앱을 통한 저장·수정은 즉시 무효화되므로 3분이 무리가 없다.
const TTL_MS = 180_000;
type Snapshot = { rows: Record<string, string>[]; at: number };
let snapshot: Snapshot | null = null;
let inFlight: Promise<Snapshot> | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function loadSnapshot(): Promise<Snapshot> {
  // 쿼터 초과는 일시적이다. 곧바로 500을 내지 말고 짧게 물러났다 다시 시도한다.
  // 지터를 주는 이유: 동시에 뜬 인스턴스들이 같은 순간에 재시도하면 다시 몰린다.
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(400 * 2 ** (attempt - 1) + Math.floor(Math.random() * 400));
    try {
      const sheet = await getQuestionSheet();
      const raw = await sheet.getRows();
      const headers = sheet.headerValues;
      const rows = raw.map((row) => {
        const o: Record<string, string> = {};
        for (const h of headers) o[h] = row.get(h) || "";
        return o;
      });
      return { rows, at: Date.now() };
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

async function getSnapshot(): Promise<Snapshot> {
  if (snapshot && Date.now() - snapshot.at < TTL_MS) return snapshot;
  if (inFlight) return inFlight;
  inFlight = loadSnapshot()
    .then((s) => { snapshot = s; return s; })
    .catch((e) => {
      // 쿼터 초과 등으로 못 읽으면 만료된 캐시라도 내준다 (수업 중단 방지)
      if (snapshot) {
        console.warn("시트 조회 실패 — 이전 캐시 사용:", String(e).slice(0, 120));
        return snapshot;
      }
      throw e;
    })
    .finally(() => { inFlight = null; });
  return inFlight;
}

/** 문항 목록 캐시를 즉시 무효화한다 (문항 저장·수정 직후) */
function invalidate() {
  snapshot = null;
}

export async function lookupAssessment(code: string) {
  const { rows } = await getSnapshot();
  return rows.find((r) => r.settingname === code) ?? null;
}

// 만들어진 평가가 들어있는 마스터 시트의 웹 주소(공유용 링크).
export async function getQuestionSheetUrl(): Promise<string> {
  const auth = getAuth();
  const id = await getFileId(auth);
  return `https://docs.google.com/spreadsheets/d/${id}/edit`;
}

export async function isCodeDuplicate(code: string): Promise<boolean> {
  const { rows } = await getSnapshot();
  return rows.some((r) => r.settingname === code);
}

export async function saveAssessment(data: Record<string, string>) {
  const sheet = await getQuestionSheet();
  await sheet.addRow(data);
  invalidate();   // 방금 만든 문항이 바로 조회되도록
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
  invalidate();   // 수정 내용이 바로 조회되도록
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
