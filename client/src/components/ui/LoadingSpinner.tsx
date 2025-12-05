import { RefreshCw } from "lucide-react";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeClasses = {
  sm: "w-4 h-4",
  md: "w-8 h-8",
  lg: "w-12 h-12",
};

export function LoadingSpinner({ size = "md", className = "" }: LoadingSpinnerProps) {
  return (
    <RefreshCw className={`animate-spin text-gray-400 ${sizeClasses[size]} ${className}`} />
  );
}

export function LoadingState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <LoadingSpinner size="md" />
      {message && <p className="mt-2 text-sm text-gray-500">{message}</p>}
    </div>
  );
}
