# 지도서 PDF → 단원별 '학생 교과서 쪽 범위' 추출.
#
# 배경: extract_pdf_text.py는 페이지 정보를 버리고 텍스트만 이어붙이므로,
#       모델이 피드백에 쓰는 "교과서 ○쪽"은 본문에 섞인 아무 숫자를 주워 온 것이었다.
#       (지도서 자체 쪽번호 222를 학생 교과서 쪽으로 인용하는 오류)
#
# 원리: 지도서의 각 차시 페이지에는 축소된 학생 교과서 지면이 이미지로 실려 있고,
#       그 지면 하단에 실제 교과서 쪽번호가 텍스트로 찍혀 있다.
#   (1) 좌표 필터 — 큰 이미지의 하단 영역에 있는 단독 숫자만 후보로
#   (2) 기울기 제약 최장 사슬 — 지도서쪽↑ 대비 교과서쪽↑ 비율이 일정한 사슬만 남겨
#       문제번호·활동번호·정답 같은 노이즈를 버림
#   (3) 보간 — 앵커 사이 페이지는 선형 보간 (앵커 간격이 벌어지면 추정 포기)
#   (4) 단원 매칭 — 카탈로그 단원명이 헤더에 있는 페이지들의 추정 쪽을 모아 범위 산출
#
# 출력: scripts/page-ranges.json  { bookKey: { 단원명: {from, to, anchors, confidence} } }
import fitz, re, json, os, sys, bisect, unicodedata
from collections import Counter

BASE = "/Users/jawoon/Library/CloudStorage/OneDrive-서울창도초등학교/# 2026 창일초 4학년 4반/@ 2026 질문이 있는 교수학습 과정안 도우미 개발/지도서_정리"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CATALOG = os.path.join(ROOT, "src/data/textbook-catalog.json")
OUT = os.path.join(ROOT, "src/data/page-ranges.json")   # 앱이 import 하는 위치

# extract_pdf_text.py와 동일한 출판사 정규화 (bookKey를 맞추기 위함)
PUB_MAP = {
    "국정": "국정", "미래엔": "미래엔", "아이스크림미디어": "아이스크림미디어", "지학사": "지학사",
    "비상교육": "비상", "비상교육설규주": "비상", "동아출판": "동아출판", "디딤돌": "디딤돌",
    "와이비엠": "와이비엠", "금성출판사": "금성출판사", "教学社": "교학사", "교학사": "교학사",
    "천재교과서정용재": "천재교과서(정용재)", "천재교과서김정인": "천재-김정인",
    "천재교과서박만구": "천재교과서(박만구)", "천재교과서한대희": "천재교과서(한대희)",
    "천재교과서박기범": "천재-박기범", "천재교과서함순애": "천재-함순애",
}


def norm(s):
    """단원명 비교용 정규화 — 공백·특수문자 제거"""
    s = unicodedata.normalize("NFKC", s)
    return re.sub(r"[\s\.\,\·\-\—\–\(\)\[\]'\"’”‘“]", "", s)


def explicit_anchors(doc, subject):
    """1순위 신호: 지도서가 헤더에 교과서 쪽을 명시한 경우.

    예) 과학 미래엔 — "『과학』 14쪽~15쪽 | 『실험관찰』 10쪽~11쪽"
        사회 천재    — "교과서 32쪽"
    과학은 『실험관찰』이라는 별도 쪽번호 계열이 같이 찍혀 있어서, 과목명이 일치하는
    책이름만 취해야 한다. (이걸 놓쳐서 실험관찰 11쪽을 교과서 쪽으로 오인했었음)
    """
    rx_book = re.compile(r"『([^』]{1,10})』\s*(\d{1,3})\s*쪽(?:\s*[~∼\-]\s*(\d{1,3})\s*쪽)?")
    rx_plain = re.compile(r"교과서\s*(\d{1,3})\s*쪽(?:\s*[~∼\-]\s*(\d{1,3})\s*쪽)?")
    out = []
    for i in range(doc.page_count):
        try:
            t = doc[i].get_text()
        except Exception:
            continue
        vals = []
        for bookname, a, b in rx_book.findall(t):
            if subject not in bookname:      # 『실험관찰』·『수학익힘』 등 배제
                continue
            vals += [int(x) for x in (a, b) if x]
        for a, b in rx_plain.findall(t):
            vals += [int(x) for x in (a, b) if x]
        for v in vals:
            if 1 <= v <= 400:   # 국어 국정이 300쪽까지 가므로 여유를 둔다
                out.append((i + 1, v))
    return sorted(set(out))


def candidates(doc):
    """2순위 신호: 축소 교과서 지면에 찍힌 단독 쪽번호.

    좌표 필터는 쓰지 않는다. 축소 교과서 지면은 이미지 조각 여러 개로 쪼개져 들어와서
    '이미지 하단 모서리' 규칙이 실제 쪽번호를 절반 넘게 놓쳤다(앵커 17개 vs 134개).
    노이즈 제거는 전적으로 chain()의 기울기 제약에 맡긴다.
    """
    out = []
    for i in range(doc.page_count):
        try:
            blocks = doc[i].get_text("dict")["blocks"]
        except Exception:
            continue
        for blk in blocks:
            if blk.get("type") != 0:
                continue
            for line in blk.get("lines", []):
                txt = "".join(sp["text"] for sp in line["spans"]).strip()
                if not re.fullmatch(r"\d{1,3}", txt):
                    continue
                n = int(txt)
                if not (1 <= n <= 300) or abs(n - (i + 1)) <= 3:
                    continue  # 지도서 자체 쪽번호 제외
                out.append((i + 1, n))
    return sorted(set(out))


def loo_accuracy(anchors, mapper_cls):
    """Leave-one-out 교차검증 — 앵커 하나를 빼고 이웃으로 예측해 실제와 비교.
    보간이 실제로 맞는지 사람 라벨 없이 정량화한다."""
    if len(anchors) < 5:
        return None
    errs = []
    for k in range(len(anchors)):
        rest = anchors[:k] + anchors[k + 1:]
        m = mapper_cls(rest)
        pred = m.est(anchors[k][0])
        if pred is not None:
            errs.append(abs(pred - anchors[k][1]))
    if not errs:
        return None
    errs.sort()
    return {
        "n": len(errs),
        "정확": sum(1 for e in errs if e == 0),
        "±1쪽": sum(1 for e in errs if e <= 1),
        "±2쪽": sum(1 for e in errs if e <= 2),
        "중앙오차": errs[len(errs) // 2],
    }


def chain(cand, slope_lo=0.08, slope_hi=1.2, max_gap=60):
    """기울기 제약 최장 사슬 — 노이즈 제거의 핵심"""
    if not cand:
        return []
    n = len(cand)
    best, prev = [1] * n, [-1] * n
    for j in range(n):
        pj, vj = cand[j]
        for i in range(j):
            pi, vi = cand[i]
            dp, dv = pj - pi, vj - vi
            if dp <= 0 or dp > max_gap or dv < 0:
                continue
            if not (slope_lo <= dv / dp <= slope_hi):
                continue
            if best[i] + 1 > best[j]:
                best[j], prev[j] = best[i] + 1, i
    k = max(range(n), key=lambda i: best[i])
    res = []
    while k != -1:
        res.append(cand[k]); k = prev[k]
    return res[::-1]


class Mapper:
    """지도서쪽 → 교과서쪽 추정기"""
    MAX_ANCHOR_GAP = 12   # 앵커 간격이 이보다 벌어지면 보간 신뢰 불가

    def __init__(self, anchors):
        m = {}
        for pp, v in anchors:
            m[pp] = max(m.get(pp, 0), v)
        self.m = m
        self.keys = sorted(m)

    def est(self, pdf_page):
        if not self.keys:
            return None
        if pdf_page in self.m:
            return self.m[pdf_page]
        j = bisect.bisect_left(self.keys, pdf_page)
        if j == 0 or j == len(self.keys):
            return None
        lo, hi = self.keys[j - 1], self.keys[j]
        if hi - lo > self.MAX_ANCHOR_GAP:
            return None
        f = (pdf_page - lo) / (hi - lo)
        return round(self.m[lo] + f * (self.m[hi] - self.m[lo]))


def unit_start_pages(doc, mapper, units):
    """단원이 시작되는 지도서 페이지.

    단원명은 목차·총론·부록에도 잔뜩 나와서 그냥 매칭하면 단원당 100쪽 넘게 잡힌다.
    두 가지로 좁힌다:
      (1) 단독 매칭 — 그 페이지에 단원명이 '하나만' 나오는 페이지가 그 단원의 차시 페이지다.
          여러 단원명이 함께 나오는 페이지는 목차·총괄표이므로 버린다.
      (2) 앵커 커버 범위 밖 군집 제거 — 뒤쪽 부록(평가 문항)에도 같은 크기의 군집이 생긴다.
          부록에는 교과서 쪽 정보가 없어서 앵커가 아예 없으므로, 앵커가 걸쳐 있는
          구간(= 차시 지도 구간) 밖의 군집은 버린다.
          (디딤돌 '4. 소수의 곱셈'이 부록 416-424를 고르던 문제)
    """
    normed = [(u, norm(u)) for u in units]
    sole = {u: [] for u in units}
    for i in range(doc.page_count):
        try:
            nh = norm(doc[i].get_text())
        except Exception:
            continue
        hit = [u for u, nu in normed if nu and nu in nh]
        if len(hit) == 1:
            sole[hit[0]].append(i + 1)

    if not mapper.keys:
        return {}
    lo_p, hi_p = mapper.keys[0], mapper.keys[-1]   # 앵커가 걸쳐 있는 구간 = 차시 지도 구간

    starts = {}
    for u, ps in sole.items():
        if len(ps) < 3:
            continue
        clusters, cur = [], [ps[0]]
        for a, b in zip(ps, ps[1:]):
            if b - a <= 20:
                cur.append(b)
            else:
                clusters.append(cur); cur = [b]
        clusters.append(cur)
        # 앵커 구간 밖(부록·목차)은 버리고, 남은 것 중 가장 큰 군집
        inside = [c for c in clusters if lo_p - 30 <= c[0] and c[-1] <= hi_p + 30]
        if not inside:
            continue
        starts[u] = max(inside, key=lambda c: (len(c), -c[0]))[0]
    return starts


def plausible(from_, to_, samples):
    """추출 실패를 걸러낸다. 틀린 범위는 없는 것만 못하다 — 프롬프트를 잘못된 값으로
    묶고, 후처리 필터가 멀쩡한 쪽수를 지워버린다.

    실측 분포(464단원): span 중앙값 23쪽, p25=20, p75=30, p95=57.
    이 밖으로 벗어나면 앵커가 모자라 구간이 뭉개졌거나 남의 단원까지 삼킨 경우다.
      - span 2쪽 (수학 아이스크림 '평면도형' 36~37) → 앵커 부족
      - span 139쪽 (사회 5-1 아이스크림) → 옆 단원까지 삼킴

    쪽수 상한은 350으로 둔다. 처음에 250으로 잡았다가 국어 국정처럼 300쪽까지 가는 책의
    멀쩡한 단원을 버렸다 (지도서 307쪽의 축소 교과서 지면에 268·269가 찍혀 있고
    본문에도 "『국어』 270쪽"이라 적혀 있음을 육안 확인).
    """
    span = to_ - from_
    return 5 <= span <= 70 and samples >= 3 and 1 <= from_ and to_ <= 350


def unit_ranges(doc, mapper, units):
    """단원별 학생 교과서 쪽 범위.

    단원 시작 페이지들을 지도서 페이지 순으로 정렬하고, 각 단원 구간을
    '이 단원 시작 ~ 다음 단원 시작 직전'으로 잡는다.
    카탈로그 순서를 강제하지 않는다 — 지도서가 카탈로그와 다른 순서로 단원을 싣는
    경우가 실제로 있다(과학 4-2 비상: '기후변화와 우리 생활'이 지도서에서는 맨 뒤).
    """
    starts = unit_start_pages(doc, mapper, units)
    if not starts:
        return {}
    ordered = sorted(starts.items(), key=lambda kv: kv[1])

    out = {}
    for k, (u, st) in enumerate(ordered):
        nxt = ordered[k + 1][1] - 1 if k + 1 < len(ordered) else doc.page_count
        vals = [v for v in (mapper.est(p) for p in range(st, nxt + 1)) if v is not None]
        if len(vals) < 2:
            continue
        lo, hi = min(vals), max(vals)
        # 걸러진 것도 남겨둔다(confident=false). 임계값을 바꿀 때 110권을 다시 돌리지
        # 않고 판단할 수 있어야 해서. 앱은 confident한 것만 쓴다.
        out[u] = {"from": lo, "to": hi, "samples": len(vals), "guide": [st, nxt],
                  "confident": plausible(lo, hi, len(vals))}
    return out


def main():
    catalog = json.load(open(CATALOG, encoding="utf-8"))
    # bookKey → 단원명 목록
    book_units = {}
    for g, sems in catalog.items():
        for sem, subs in sems.items():
            for sub, pubs in subs.items():
                for pub, arr in pubs.items():
                    book_units[f"{sub}|{g}|{sem}|{pub}"] = [x["unitRaw"] for x in arr]

    targets = json.load(open("/tmp/oeq_bookkeys.json", encoding="utf-8"))
    only = sys.argv[1:] or None

    # PDF 목록 → bookKey 매핑
    pdfs = {}
    for fn in os.listdir(BASE):
        if not fn.endswith(".pdf"):
            continue
        parts = fn[:-4].split("_")
        if len(parts) < 5:
            continue
        sub, g, sem, pubtok = parts[0], parts[1], parts[2], parts[3]
        pub = PUB_MAP.get(pubtok, pubtok)
        pdfs[f"{sub}|{g}|{sem}|{pub}"] = os.path.join(BASE, fn)

    result, stats = {}, Counter()
    todo = [b for b in targets if not only or b in only]
    for idx, bk in enumerate(todo, 1):
        path = pdfs.get(bk)
        if not path:
            stats["PDF없음"] += 1
            print(f"[{idx}/{len(todo)}] ⚠️  PDF 못 찾음: {bk}", flush=True)
            continue
        units = book_units.get(bk, [])
        if not units:
            stats["카탈로그없음"] += 1
            print(f"[{idx}/{len(todo)}] ⚠️  카탈로그 단원 없음: {bk}", flush=True)
            continue
        subject = bk.split("|")[0]
        try:
            doc = fitz.open(path)
            exp = explicit_anchors(doc, subject)
            # 명시 앵커가 충분하면 그것만 쓴다(훨씬 정확). 부족하면 숫자 추출로 대체.
            if len({p for p, _ in exp}) >= 20:
                src, anchors = "명시", chain(exp)
            else:
                src, anchors = "추출", chain(candidates(doc))
            mapper = Mapper(anchors)
            ranges = unit_ranges(doc, mapper, units)
            acc = loo_accuracy(anchors, Mapper)
            doc.close()
        except Exception as e:
            stats["오류"] += 1
            print(f"[{idx}/{len(todo)}] ❌ {bk}: {e}", flush=True)
            continue

        cov = sum(1 for v in ranges.values() if v["confident"])
        if cov == 0:
            stats["범위0"] += 1
        elif cov < len(units) * 0.6:
            stats["부분"] += 1
        else:
            stats["양호"] += 1
        result[bk] = {"source": src, "anchors": len(anchors), "loo": acc, "units": ranges}
        a = f"LOO ±1쪽 {acc['±1쪽']}/{acc['n']}" if acc else "LOO -"
        print(f"[{idx}/{len(todo)}] {bk} — [{src}] 앵커 {len(anchors)}개, 단원 {cov}/{len(units)}개, {a} "
              f"{ {u.split('.')[0]: (v['from'], v['to']) for u, v in list(ranges.items())[:4] if v['confident']} }", flush=True)

    json.dump(result, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"\n저장: {OUT}")
    print(f"집계: {dict(stats)}")


if __name__ == "__main__":
    main()
