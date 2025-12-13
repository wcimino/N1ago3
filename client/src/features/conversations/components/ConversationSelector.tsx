import { ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ConversationStatusBadge } from "../../../shared/components/badges";

interface ConversationSelectorProps {
  selectedIndex: number;
  totalCount: number;
  formattedDate: string | undefined;
  isActive: boolean;
  closedReason?: string | null;
  onPrevious: () => void;
  onNext: () => void;
  actionButtons?: ReactNode;
}

export function ConversationSelector({
  selectedIndex,
  totalCount,
  formattedDate,
  isActive,
  closedReason,
  onPrevious,
  onNext,
  actionButtons,
}: ConversationSelectorProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      <button
        onClick={onPrevious}
        disabled={selectedIndex === 0}
        className="p-2 rounded-lg border border-gray-400 hover:border-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-4 h-4 text-gray-600" />
      </button>
      
      <div className="flex-1 text-center">
        <p className="text-sm font-medium text-gray-900">
          Conversa {selectedIndex + 1} de {totalCount}
        </p>
        <p className="text-xs text-gray-500 flex items-center justify-center gap-2">
          {formattedDate}
          <ConversationStatusBadge 
            status={isActive ? "active" : "closed"} 
            closedReason={closedReason} 
          />
        </p>
      </div>
      
      <div className="flex items-center gap-1.5">
        <button
          onClick={onNext}
          disabled={selectedIndex === totalCount - 1}
          className="p-2 rounded-lg border border-gray-400 hover:border-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
        {actionButtons}
      </div>
    </div>
  );
}
