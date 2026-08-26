"use client";

// 교사 접속 코드의 브라우저 쪽 취급. 한 번 입력하면 이 브라우저에 기억해두고
// 교사용 API 호출마다 헤더로 붙인다. (서버 검증은 lib/teacher-auth.ts)

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "teacherAccessCode";
const CHANGED_EVENT = "teacher-code-changed";
export const TEACHER_HEADER = "x-teacher-code";

export function getTeacherCode(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return ""; // 사생활 보호 모드 등에서 접근 자체가 막히는 경우
  }
}

function announce(): void {
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

export function setTeacherCode(code: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* 저장 못 해도 이번 세션은 그대로 진행 */
  }
  announce();
}

export function clearTeacherCode(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* noop */
  }
  announce();
}

/**
 * 저장된 교사 코드를 구독한다. 서버 렌더에서는 항상 "" —
 * localStorage는 브라우저에만 있으므로 그게 유일하게 맞는 서버 스냅샷이다.
 *
 * 구독을 두는 이유: 헤더('문항 목록' 링크)는 레이아웃에 있고 잠금 화면은
 * 교사 페이지 안에 있어서, 코드를 입력해도 헤더가 저절로 다시 그려지지 않는다.
 * storage 이벤트는 '다른 탭'에서만 오므로 같은 탭용 이벤트를 직접 쏜다.
 */
export function useTeacherCode(): string {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener(CHANGED_EVENT, onChange);
      window.addEventListener("storage", onChange);
      return () => {
        window.removeEventListener(CHANGED_EVENT, onChange);
        window.removeEventListener("storage", onChange);
      };
    },
    getTeacherCode,
    () => ""
  );
}

/** 교사 코드를 붙여 링크 이동용 URL을 만든다 (헤더를 실을 수 없는 <a> 용). */
export function teacherUrl(path: string): string {
  const code = getTeacherCode();
  if (!code) return path;
  return `${path}${path.includes("?") ? "&" : "?"}t=${encodeURIComponent(code)}`;
}

/**
 * 교사용 fetch. 코드 헤더를 붙이고, 코드가 더 이상 맞지 않으면(401)
 * 저장된 코드를 지우고 잠금 화면으로 되돌린다.
 */
export async function teacherFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  // HTTP 헤더 값은 비ASCII를 그대로 실을 수 없다. 한글 코드를 그냥 넣으면 값이
  // 깨져 서버에서 안 맞는다(실제로 겪음). 퍼센트 인코딩해서 보내고 서버가 푼다.
  headers.set(TEACHER_HEADER, encodeURIComponent(getTeacherCode()));

  const res = await fetch(input, { ...init, headers });
  if (res.status === 401) {
    clearTeacherCode();
    window.location.reload();
  }
  return res;
}
