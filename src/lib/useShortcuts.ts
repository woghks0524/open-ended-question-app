"use client";

import { useEffect, useRef } from "react";

// Ctrl+Enter(또는 Cmd+Enter): 현재 단계의 주 동작(저장·확인 등) 실행
export function useCtrlEnter(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !e.altKey) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

// Alt+Enter: 다음 단계로 이동
export function useAltEnter(handler: () => void) {
  const ref = useRef(handler);
  ref.current = handler;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && e.altKey && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        ref.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}
