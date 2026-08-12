"use client";

import { useState } from "react";

// 클릭하면 화면 가득 확대해서 보여주는 이미지 (문항 자료용)
export default function ZoomableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="block text-left">
        <img
          src={src}
          alt={alt}
          className="mt-3 max-w-[300px] rounded border cursor-zoom-in hover:opacity-90 transition-opacity"
        />
        <span className="block mt-1 text-xs text-gray-400">🔍 이미지를 누르면 크게 볼 수 있어요</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[100] bg-black/70 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setOpen(false)}
        >
          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full rounded-lg shadow-2xl bg-white"
          />
          <button
            type="button"
            aria-label="닫기"
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 text-gray-700 text-xl font-bold shadow"
            onClick={() => setOpen(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
