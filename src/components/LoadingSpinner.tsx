"use client";

export default function LoadingSpinner({ message = "처리 중..." }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-gray-600 text-sm">{message}</span>
    </div>
  );
}
