# 지도서 PDF(국수사과) → 텍스트 추출. 원문 텍스트만 뽑아 file_search용으로 준비.
# 출판사명은 카탈로그(엑셀)와 일치하도록 정규화.
# 결과: /tmp/oeq_pdftext/<bookKey>.txt + /tmp/oeq_pdf_manifest.json
import os, glob, json, re
import fitz  # pymupdf (빠른 텍스트 추출)

BASE = "/Users/jawoon/Library/CloudStorage/OneDrive-서울창도초등학교/@ 2026 질문이 있는 교수학습 과정안 도우미 개발/지도서_정리"
OUT = "/tmp/oeq_pdftext"
os.makedirs(OUT, exist_ok=True)
SUBJECTS = ["국어", "수학", "사회", "과학"]

# PDF 파일명 출판사 토큰 → 엑셀 카탈로그 출판사명
PUB_MAP = {
    "국정": "국정", "미래엔": "미래엔", "아이스크림미디어": "아이스크림미디어", "지학사": "지학사",
    "비상교육": "비상", "비상교육설규주": "비상",
    "천재교과서정용재": "천재교과서(정용재)", "천재교과서김정인": "천재-김정인",
    "천재교과서박만구": "천재교과서(박만구)", "천재교과서한대희": "천재교과서(한대희)",
}

manifest = []
files = sorted(glob.glob(os.path.join(BASE, "*.pdf")))
files = [f for f in files if os.path.basename(f).split("_")[0] in SUBJECTS]
print(f"대상 {len(files)}개", flush=True)

for idx, p in enumerate(files):
    name = os.path.basename(p)[:-4]  # remove .pdf
    parts = name.split("_")  # 과목_학년_학기_출판사_지도서
    if len(parts) < 5:
        print(f"  ⚠️ 파일명 형식 예외: {name}", flush=True); continue
    subject, grade, semester, pubtoken = parts[0], parts[1], parts[2], parts[3]
    publisher = PUB_MAP.get(pubtoken)
    if not publisher:
        print(f"  ⚠️ 출판사 미매핑: {pubtoken} ({name})", flush=True)
        publisher = pubtoken
    bookKey = f"{subject}|{grade}|{semester}|{publisher}"
    try:
        doc = fitz.open(p)
        pages = [doc[i].get_text() for i in range(doc.page_count)]
        npages = doc.page_count
        doc.close()
        text = "\n".join(pages)
        text = re.sub(r"\n{3,}", "\n\n", text)
        outpath = os.path.join(OUT, bookKey.replace("|", "_").replace("/", "-") + ".txt")
        with open(outpath, "w", encoding="utf-8") as f:
            f.write(text)
        manifest.append({"bookKey": bookKey, "subject": subject, "grade": grade,
                         "semester": semester, "publisher": publisher,
                         "pages": npages, "chars": len(text), "txt": outpath})
        print(f"  [{idx+1}/{len(files)}] {bookKey} — {npages}쪽, {len(text)}자", flush=True)
    except Exception as e:
        print(f"  ❌ {name}: {e}", flush=True)

with open("/tmp/oeq_pdf_manifest.json", "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=2)
short = [m["bookKey"] for m in manifest if m["chars"] < 3000]
print(f"\n완료: {len(manifest)}개 추출. 텍스트 빈약(<3000자): {short}", flush=True)
