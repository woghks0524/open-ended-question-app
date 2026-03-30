"use client";

interface StepNavigationProps {
  onPrev?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  prevLabel?: string;
  nextDisabled?: boolean;
  showPrev?: boolean;
  showNext?: boolean;
}

export default function StepNavigation({
  onPrev,
  onNext,
  nextLabel = "다음 단계",
  prevLabel = "이전 단계",
  nextDisabled = false,
  showPrev = true,
  showNext = true,
}: StepNavigationProps) {
  return (
    <div className="flex gap-3 mt-8 pt-6 border-t border-gray-200">
      {showPrev && onPrev && (
        <button
          onClick={onPrev}
          className="px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
        >
          {prevLabel}
        </button>
      )}
      {showNext && onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="px-5 py-2.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
