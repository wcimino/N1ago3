import type { KeyboardEvent } from "react";
import { MessageCircle, Clock, Sparkles, Package, Target, MessageSquare, ChevronRight } from "lucide-react";
import { useDateFormatters } from "../hooks/useDateFormatters";
import { INTENT_LABELS, INTENT_COLORS } from "../lib/constants";
import type { ConversationSummary } from "../types";

export interface SummaryCardProps {
  summary: ConversationSummary | null;
  conversationId: string;
  conversationDate: string;
  conversationStatus: string;
  messagesCount: number;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

export function SummaryCard({ 
  summary, 
  conversationId, 
  conversationDate, 
  conversationStatus,
  messagesCount,
  isSelected, 
  onClick,
  compact = false
}: SummaryCardProps) {
  const { formatDateTimeShort, formatRelativeTime } = useDateFormatters();
  
  const shortId = conversationId.slice(0, 8);
  const updatedAtDate = summary?.updated_at ? new Date(summary.updated_at) : null;
  const timeAgo = updatedAtDate ? formatRelativeTime(updatedAtDate) : null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

  if (compact) {
    return (
      <div 
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={handleKeyDown}
        aria-selected={isSelected}
        className={`
          p-3 rounded-lg border-2 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-1
          ${isSelected 
            ? 'border-purple-500 bg-purple-50 shadow-md' 
            : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm active:bg-gray-50'
          }
        `}
      >
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <MessageCircle className="w-4 h-4 text-purple-600 flex-shrink-0" />
              <span className="font-medium text-gray-900 text-sm truncate">Conversa {shortId}...</span>
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${
                conversationStatus === "active" 
                  ? "bg-green-100 text-green-700" 
                  : "bg-gray-100 text-gray-600"
              }`}>
                {conversationStatus}
              </span>
            </div>
            
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 mb-2">
              <Clock className="w-3 h-3" />
              <span>{formatDateTimeShort(conversationDate)}</span>
              <span className="text-gray-300">•</span>
              <span>{messagesCount} msgs</span>
            </div>

            <div className="flex flex-wrap gap-1">
              {summary?.product && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded-full text-[10px] font-medium">
                  <Package className="w-2.5 h-2.5" />
                  {summary.product}
                </span>
              )}
              {summary?.intent && (
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${INTENT_COLORS[summary.intent] || INTENT_COLORS.outros}`}>
                  <Target className="w-2.5 h-2.5" />
                  {INTENT_LABELS[summary.intent] || summary.intent}
                </span>
              )}
              {summary?.confidence !== null && summary?.confidence !== undefined && (
                <span className="inline-flex items-center px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-[10px]">
                  {summary.confidence}%
                </span>
              )}
            </div>
          </div>
          
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0 ml-2" />
        </div>
      </div>
    );
  }

  return (
    <div 
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      aria-selected={isSelected}
      className={`
        p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2
        ${isSelected 
          ? 'border-purple-500 bg-purple-50 shadow-md' 
          : 'border-gray-200 bg-white hover:border-purple-300 hover:shadow-sm'
        }
      `}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-purple-600" />
          <span className="font-medium text-gray-900">Conversa {shortId}...</span>
        </div>
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
          conversationStatus === "active" 
            ? "bg-green-100 text-green-700" 
            : "bg-gray-100 text-gray-600"
        }`}>
          {conversationStatus}
        </span>
      </div>
      
      <div className="flex items-center gap-2 text-xs text-gray-500 mb-3">
        <Clock className="w-3 h-3" />
        <span>{formatDateTimeShort(conversationDate)}</span>
        <span className="text-gray-300">•</span>
        <MessageSquare className="w-3 h-3" />
        <span>{messagesCount} msgs</span>
      </div>

      {summary ? (
        <>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {summary.product && (
              <div className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
                <Package className="w-3 h-3" />
                {summary.product}
              </div>
            )}
            {summary.intent && (
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${INTENT_COLORS[summary.intent] || INTENT_COLORS.outros}`}>
                <Target className="w-3 h-3" />
                {INTENT_LABELS[summary.intent] || summary.intent}
              </div>
            )}
            {summary.confidence !== null && (
              <div className="inline-flex items-center px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">
                {summary.confidence}%
              </div>
            )}
          </div>
          
          <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
            {summary.text}
          </p>
          
          {timeAgo && (
            <p className="text-xs text-purple-500 mt-2 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              Atualizado {timeAgo}
            </p>
          )}
        </>
      ) : (
        <div className="flex items-center gap-2 text-gray-400">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm">Resumo ainda não gerado</span>
        </div>
      )}
    </div>
  );
}
