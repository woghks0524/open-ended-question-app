# "생각을 키우는 교실" 서·논술형 문항자료 PDF → 문항별 청크 JSON.
# import-thinking-class.mjs 의 입력을 만든다. (기존 extract_all.py 재작성본)
#
# 문항 경계: 각 문항은 "교수·학습 활동 및 평가 흐름도" 페이지로 시작한다.
#           그 페이지 안에 "NN. 제목" 형태의 문항 번호·제목이 함께 나온다.
# 출력: [{no, title, pages:[...], text, figurePages:[...]}]
import fitz, re, json, os, sys

BASE = ("/Users/jawoon/Library/CloudStorage/OneDrive-서울창도초등학교/"
        "# 2026 창일초 4학년 4반/23 생각을 키우는 교실/"
        "생각을 키우는 교실 서논술형 평가 문항 자료(3~6학년)")
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

MARKER = re.compile(r"교수\s*[‧·・]?\s*학습\s*활동\s*및\s*평가\s*흐름도")
# 흐름도 페이지 상단의 "58. 내가 찾은 자석의 성질 이용하여 …"
TITLE = re.compile(r"^\s*(\d{1,3})\.\s*(.+?)\s*$", re.M)


def squeeze(s):
    return re.sub(r"\s+", "", s)


def chunk_pdf(path, grade):
    doc = fitz.open(path)
    pages = [doc[i].get_text() for i in range(doc.page_count)]

    # 1) 흐름도 마커가 있는 페이지 = 문항 시작
    starts = []
    for i, t in enumerate(pages):
        if not MARKER.search(squeeze(t)) and not MARKER.search(t):
            continue
        # 그 페이지에서 문항 번호·제목 찾기 (앞쪽 600자 안)
        head = t[:600]
        cands = TITLE.findall(head)
        no, title = None, ""
        for n, ttl in cands:
            n = int(n)
            # 목차의 나열(제목만 잔뜩)과 구분: 흐름도 페이지는 번호가 하나만 크게 나옴
            if 1 <= n <= 200 and len(ttl) >= 6:
                no, title = n, ttl.strip()
                break
        starts.append((i, no, title))

    # 목차 페이지가 섞이면 번호가 중복·역행한다 → 단조증가하는 것만 채택
    clean = []
    for i, no, title in starts:
        if no is None:
            continue
        if clean and no <= clean[-1][1]:
            continue
        clean.append((i, no, title))

    out = []
    for k, (i, no, title) in enumerate(clean):
        end = clean[k + 1][0] if k + 1 < len(clean) else doc.page_count
        pg = list(range(i, end))
        text = "\n".join(pages[p] for p in pg)
        # 그림이 많은 페이지 = 활동지/예시 답안 지면
        figs = [p + 1 for p in pg if len(doc[p].get_images()) >= 3]
        out.append({"no": no, "title": title, "grade": grade,
                    "pages": [p + 1 for p in pg], "figurePages": figs,
                    "chars": len(text), "text": text})
    doc.close()
    return out


def main():
    grades = sys.argv[1:] or ["3", "4", "5", "6"]
    for g in grades:
        path = f"{BASE}/생각을 키우는 교실-서논술형평가문항자료-{g}학년.pdf"
        if not os.path.exists(path):
            print(f"⚠️ 없음: {path}")
            continue
        chunks = chunk_pdf(path, g)
        outp = os.path.join(ROOT, f"scripts/thinking-class-chunks-g{g}.json")
        json.dump(chunks, open(outp, "w", encoding="utf-8"), ensure_ascii=False)
        nos = [c["no"] for c in chunks]
        gaps = [n for n in range(min(nos), max(nos) + 1) if n not in nos] if nos else []
        print(f"{g}학년: 문항 {len(chunks)}개 (번호 {min(nos)}~{max(nos)}), "
              f"빠진 번호 {gaps if gaps else '없음'}, 평균 {sum(c['chars'] for c in chunks)//len(chunks)}자 → {outp}")


if __name__ == "__main__":
    main()
