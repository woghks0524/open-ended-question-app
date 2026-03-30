"use client";

interface StepperProps {
  steps: string[];
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export default function Stepper({ steps, currentStep, onStepClick }: StepperProps) {
  return (
    <div className="w-full mb-8">
      <div className="flex items-center justify-between">
        {steps.map((label, idx) => {
          const isActive = idx === currentStep;
          const isCompleted = idx < currentStep;

          return (
            <div key={idx} className="flex-1 flex flex-col items-center relative">
              {/* Connector line */}
              {idx > 0 && (
                <div
                  className={`absolute top-4 -left-1/2 w-full h-0.5 ${
                    idx <= currentStep ? "bg-blue-500" : "bg-gray-300"
                  }`}
                />
              )}

              {/* Circle */}
              <button
                onClick={() => onStepClick?.(idx)}
                disabled={!onStepClick}
                className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors
                  ${isActive ? "bg-blue-500 text-white ring-4 ring-blue-100" : ""}
                  ${isCompleted ? "bg-blue-500 text-white" : ""}
                  ${!isActive && !isCompleted ? "bg-gray-300 text-gray-600" : ""}
                  ${onStepClick ? "cursor-pointer hover:ring-2 hover:ring-blue-200" : "cursor-default"}
                `}
              >
                {isCompleted ? "✓" : idx + 1}
              </button>

              {/* Label */}
              <span
                className={`mt-2 text-xs text-center leading-tight max-w-[80px] ${
                  isActive ? "text-blue-600 font-semibold" : "text-gray-500"
                }`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
