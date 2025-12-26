import { ArrowLeft } from "lucide-react";

interface CustomerHeaderProps {
  name: string;
  conversationCount: number;
  messageCount: number;
  onBack: () => void;
  compact?: boolean;
  rounded?: boolean;
}

export function CustomerHeader({
  name,
  conversationCount,
  messageCount,
  onBack,
  compact = false,
  rounded = false,
}: CustomerHeaderProps) {
  const conversationLabel = conversationCount === 1 ? "conversa" : "conversas";
  
  return (
    <div className={`${compact ? "px-3 py-2" : "px-3 sm:px-4 py-2 sm:py-3"} border-b border-gray-200 bg-white ${rounded ? "rounded-t-lg shadow-sm" : ""}`}>
      <div className={`flex items-center ${compact ? "gap-2" : "gap-2 sm:gap-3"}`}>
        <button
          onClick={onBack}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 flex-shrink-0"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className={`${compact ? "text-sm" : "text-sm sm:text-base lg:text-lg"} font-semibold text-gray-900 truncate`}>
            {name}
          </h2>
          <p className="text-xs text-gray-500 truncate">
            {conversationCount} {conversationLabel} - {messageCount} msg
          </p>
        </div>
      </div>
    </div>
  );
}
