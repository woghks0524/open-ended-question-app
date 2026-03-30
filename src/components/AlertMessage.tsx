"use client";

interface AlertMessageProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onClose?: () => void;
}

const styles = {
  success: "bg-green-50 border-green-200 text-green-800",
  error: "bg-red-50 border-red-200 text-red-800",
  warning: "bg-yellow-50 border-yellow-200 text-yellow-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export default function AlertMessage({ type, message, onClose }: AlertMessageProps) {
  if (!message) return null;

  return (
    <div className={`p-3 rounded-lg border text-sm ${styles[type]} flex items-center justify-between mt-3`}>
      <span>{message}</span>
      {onClose && (
        <button onClick={onClose} className="ml-3 font-bold opacity-60 hover:opacity-100">
          ×
        </button>
      )}
    </div>
  );
}
