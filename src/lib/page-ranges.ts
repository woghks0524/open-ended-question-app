import RANGES from "@/data/page-ranges.json";

// 단원별 '학생 교과서 쪽 범위'. scripts/extract-page-anchors.py 가 지도서 PDF에서 뽑아 생성한다.
//
// 왜 필요한가: 벡터스토어에 올린 지도서 텍스트에는 페이지 정보가 없어서(extract_pdf_text.py가
// 페이지를 그냥 이어붙임), 모델이 쓰는 "교과서 ○쪽"은 본문에 섞인 아무 숫자를 주워 온 것이었다.
// 실제로 지도서 자체 쪽번호(222쪽)를 학생 교과서 쪽인 것처럼 인용하는 오류가 관측됐다.
// (합동과 대칭 단원의 실제 교과서 쪽은 52~72쪽)

export type PageRange = { from: number; to: number };

type Unit = { from: number; to: number; confident: boolean };
type Book = { units: Record<string, Unit> };
const DATA = RANGES as unknown as Record<string, Book>;

/**
 * unitKey = "과목|학년|학기|출판사|단원" (카탈로그 key와 동일 형식)
 * confident=false 인 단원은 없는 것으로 취급한다. 추출이 뭉개진 범위를 쓰면
 * 프롬프트를 틀린 값으로 묶고 후처리 필터가 멀쩡한 쪽수를 지운다.
 */
export function getPageRange(unitKey: string | undefined): PageRange | null {
  if (!unitKey) return null;
  const parts = unitKey.split("|");
  if (parts.length < 5) return null;
  const bookKey = parts.slice(0, 4).join("|");
  const unit = parts.slice(4).join("|");
  const hit = DATA[bookKey]?.units?.[unit];
  return hit?.confident ? { from: hit.from, to: hit.to } : null;
}

/** 프롬프트에 넣을 안내문. 범위를 모르면 쪽수를 쓰지 않도록 지시한다. */
export function pageRangeHint(range: PageRange | null): string {
  if (!range) {
    return "이 단원의 교과서 쪽 범위 정보가 없습니다. 쪽수를 추측해서 쓰지 말고, " +
      "'이 단원의 ○○ 부분'처럼 내용으로 안내하세요.";
  }
  // 범위를 알려주되 '범위로만 답하기'로 도망가지 않게 한다. 범위만 주면 안전하지만
  // 학생 입장에서는 20쪽을 뒤지라는 말이라 쓸모가 떨어진다.
  return `이 단원의 학생 교과서 쪽 범위는 ${range.from}~${range.to}쪽입니다. ` +
    `자료에서 해당 내용이 실린 쪽을 확인할 수 있으면 "교과서 ○쪽"으로 그 쪽을 정확히 짚어주세요 ` +
    `(반드시 ${range.from}~${range.to} 안의 값이어야 합니다). ` +
    `확인이 어려울 때만 "교과서 ${range.from}~${range.to}쪽"처럼 범위로 안내하세요. ` +
    `이 범위 밖의 숫자는 절대 쪽수로 쓰지 마세요.`;
}

/**
 * 피드백에 나온 쪽수 인용을 검증한다. 모델이 지시를 어기는 경우가 있어 출력에서 한 번 더 거른다.
 * - 범위 안의 쪽 → 그대로 둔다
 * - 범위 밖의 쪽 → 단원 쪽 범위로 바꾼다 (쪽수를 지우지 않고 맞는 범위를 주는 편이 학생에게 낫다)
 * - 범위를 모르는 단원 → 손대지 않는다 (판단 근거가 없으므로)
 */
export function sanitizePageCitations(text: string, range: PageRange | null): {
  text: string;
  fixed: number[];
} {
  if (!range || !text) return { text, fixed: [] };
  const fixed: number[] = [];

  const inRange = (n: number) => n >= range.from && n <= range.to;
  const replacement = `${range.from}~${range.to}쪽`;

  // 범위 표기 먼저 — "222~228쪽", "222쪽~228쪽"
  let out = text.replace(
    /(\d{1,3})\s*쪽?\s*[~∼-]\s*(\d{1,3})\s*쪽/g,
    (whole, a: string, b: string) => {
      const nums = [Number(a), Number(b)];
      if (nums.every(inRange)) return whole;
      fixed.push(...nums);
      return replacement;
    }
  );
  // 단일 표기 — "교과서 222쪽"
  out = out.replace(/(\d{1,3})\s*쪽/g, (whole, a: string) => {
    const n = Number(a);
    if (inRange(n)) return whole;
    fixed.push(n);
    return replacement;
  });
  return { text: out, fixed };
}
