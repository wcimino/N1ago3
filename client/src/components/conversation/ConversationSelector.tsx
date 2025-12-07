import { ChevronLeft, ChevronRight } from "lucide-react";

interface ConversationSelectorProps {
  selectedIndex: number;
  totalCount: number;
  formattedDate: string | undefined;
  isActive: boolean;
  onPrevious: () => void;
  onNext: () => void;
}

export function ConversationSelector({
  selectedIndex,
  totalCount,
  formattedDate,
  isActive,
  onPrevious,
  onNext,
}: ConversationSelectorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      <button
        onClick={onPrevious}
        disabled={selectedIndex === 0}
        className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>
      
      <div className="flex-1 text-center">
        <p className="text-sm font-medium text-gray-900">
          Conversa {selectedIndex + 1} de {totalCount}
        </p>
        <p className="text-xs text-gray-500">
          {formattedDate}
          {isActive && (
            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              ativa
            </span>
          )}
        </p>
      </div>
      
      <button
        onClick={onNext}
        disabled={selectedIndex === totalCount - 1}
        className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );
}
