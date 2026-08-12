// 문항 텍스트 가독성 표시: 저장된 문장은 그대로 두고, 화면에서만 구획별로 줄을 나눠 보여준다.
// - [상황], [조건], [피아노 목록] 같은 대괄호 구획 앞에서 줄바꿈(+빈 줄)
// - "1) 2)" 하위 문항, "① ②" 항목이 문장 끝 뒤에 이어지면 줄바꿈
// - "가나다 / 라마바" 식의 목록 구분자( / )는 줄바꿈으로
export function formatQuestion(text: string): string {
  let t = text;
  // 이미 줄바꿈이 충분히 있으면 대부분 그대로 유지된다(아래 치환은 중복 줄바꿈을 만들지 않음)
  t = t.replace(/\s*(\[[^\]\n]{1,20}\])\s*/g, "\n\n$1 "); // [구획] 앞뒤 정리
  t = t.replace(/([.다요오시!?])\s+(\d\))/g, "$1\n$2"); // 문장 끝 + "1)" → 줄바꿈
  t = t.replace(/([.다요오시!?])\s+([①②③④⑤⑥⑦⑧])/g, "$1\n$2"); // 문장 끝 + ① → 줄바꿈
  t = t.replace(/\s+\/\s+/g, "\n"); // " / " 목록 구분자 → 줄바꿈
  t = t.replace(/(조건\s*\d[).:]?)/g, "\n$1"); // 조건 1) 조건 2) → 줄바꿈
  t = t.replace(/\n{3,}/g, "\n\n").trim(); // 과도한 빈 줄 정리
  return t;
}

export default function QuestionText({ text, className = "" }: { text: string; className?: string }) {
  return (
    <p className={`whitespace-pre-wrap leading-relaxed ${className}`}>{formatQuestion(text)}</p>
  );
}
