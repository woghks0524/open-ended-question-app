#!/bin/bash
# 에듀집 제출용 PDF 2종 + 소개 문단 txt를 만들어 OneDrive에 복사한다.
# 방침 본문을 고쳤으면 public/privacy.html만 고치고 이 스크립트를 돌리면 된다.
set -euo pipefail

STAMP="260904"                          # 파일명 날짜 (YYMMDD). 새로 낼 때 HTML의 작성일/시행일도 함께 고칠 것
NAME="AI 서술형 평가 도우미_정재환"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT="$HOME/Library/CloudStorage/OneDrive-서울창도초등학교/@ 앱 개발/서술형평가도우미"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

[ -x "$CHROME" ] || { echo "Chrome을 찾을 수 없습니다: $CHROME"; exit 1; }
mkdir -p "$OUT"

render() {  # render <입력 html> <출력 pdf>
  "$CHROME" --headless --disable-gpu --no-pdf-header-footer \
    --print-to-pdf="$2" "file://$1" 2>/dev/null
}

render "$ROOT/docs/에듀집/체크리스트.html" "$TMP/checklist.pdf"
render "$ROOT/public/privacy.html"          "$TMP/privacy.pdf"

cp "$TMP/checklist.pdf" "$OUT/체크리스트($NAME)_$STAMP.pdf"
cp "$TMP/privacy.pdf"   "$OUT/개인정보 처리방침($NAME)_$STAMP.pdf"
cp "$ROOT/docs/에듀집/소개문단.txt" "$OUT/소개 문단($NAME)_$STAMP.txt"

echo "생성 완료 → $OUT"
ls -la "$OUT"
