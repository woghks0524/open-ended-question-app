-- 서술형 평가 문항 테이블
-- 구글 시트(마스터 시트)를 대체한다. 시트 API 쿼터 때문에 50명 동시 접속 시
-- 문항 조회가 실패하던 문제의 근본 해결책.
-- Supabase SQL Editor에서 이 파일 전체를 실행하면 된다.

create table if not exists assessments (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),

  -- 평가 코드 (학생이 입력하는 값, 고유)
  settingname text not null unique,

  -- 문항 (최대 3개)
  question1 text not null default '',
  question2 text not null default '',
  question3 text not null default '',
  image1 text not null default '',
  image2 text not null default '',
  image3 text not null default '',

  -- 모범답안·채점지침 (학생 화면에 절대 내려보내지 않는 값)
  correctanswer1 text not null default '',
  correctanswer2 text not null default '',
  correctanswer3 text not null default '',
  feedbackinstruction text not null default '',

  -- 단원 정보
  unitkey text not null default '',
  grade text not null default '',
  semester text not null default '',
  subject text not null default '',
  publisher text not null default '',
  unit text not null default '',

  -- 부가 설정
  vectorapi text not null default '',   -- 이 평가 전용 벡터스토어 ID
  sheeturl text not null default '',    -- 교사 결과 저장용 구글 시트 URL
  timestamp text not null default ''    -- 기존 시트의 표시용 저장 시각 (한국 시간 문자열)
);

-- 코드 조회가 가장 잦으므로 인덱스 (unique 제약으로 이미 생기지만 명시)
create index if not exists assessments_settingname_idx on assessments (settingname);

-- RLS를 켜고 정책은 만들지 않는다.
-- 이 앱은 서버(API 라우트)에서 service_role 키로만 접근하므로
-- 브라우저에서 anon 키로 직접 읽는 경로 자체가 없다.
alter table assessments enable row level security;
