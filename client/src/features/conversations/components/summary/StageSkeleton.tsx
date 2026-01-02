import { Loader2 } from "lucide-react";

interface StageSkeletonProps {
  title: string;
  isRunning?: boolean;
}

export function StageSkeleton({ title, isRunning }: StageSkeletonProps) {
  return (
    <div className="rounded-lg p-3 bg-gray-50 border border-gray-200 animate-pulse">
      <div className="flex items-center gap-2">
        {isRunning ? (
          <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
        ) : (
          <div className="w-4 h-4 rounded bg-gray-200" />
        )}
        <span className="text-sm text-gray-500">{title}</span>
        {isRunning && <span className="text-xs text-purple-500">Processando...</span>}
      </div>
      <div className="mt-2 space-y-2">
        <div className="h-3 bg-gray-200 rounded w-3/4" />
        <div className="h-3 bg-gray-200 rounded w-1/2" />
      </div>
    </div>
  );
}
