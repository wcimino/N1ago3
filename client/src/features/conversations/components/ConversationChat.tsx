import { RefObject, useMemo, useState } from "react";
import { Sparkles, BookOpen, ExternalLink, X } from "lucide-react";
import { MessageBubble } from "../../../shared/components/ui/MessageBubble";
import type { ImagePayload, Message } from "../../../types";

interface ArticleUsed {
  id: number;
  name: string;
  product: string;
  url?: string;
}

interface SuggestedResponse {
  text: string;
  created_at: string;
  status?: string | null;
  articles_used?: ArticleUsed[] | null;
}

type ChatItem = 
  | { type: "message"; data: Message; timestamp: number }
  | { type: "suggestion"; data: SuggestedResponse; index: number; timestamp: number };

interface ConversationChatProps {
  messages: Message[];
  suggestedResponses?: SuggestedResponse[];
  onImageClick: (image: ImagePayload) => void;
  formatDateTime: (date: string) => string;
  chatEndRef?: RefObject<HTMLDivElement>;
  currentHandlerName?: string | null;
}

export function ConversationChat({
  messages,
  suggestedResponses = [],
  onImageClick,
  formatDateTime,
  chatEndRef,
  currentHandlerName,
}: ConversationChatProps) {
  const sortedItems = useMemo(() => {
    const items: ChatItem[] = [];
    
    messages.forEach((msg) => {
      items.push({
        type: "message",
        data: msg,
        timestamp: new Date(msg.received_at).getTime(),
      });
    });
    
    suggestedResponses.forEach((suggestion, index) => {
      items.push({
        type: "suggestion",
        data: suggestion,
        index,
        timestamp: new Date(suggestion.created_at).getTime(),
      });
    });
    
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [messages, suggestedResponses]);

  return (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      <div className="space-y-3 max-w-2xl mx-auto">
        {sortedItems.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhuma mensagem nesta conversa
          </div>
        ) : (
          sortedItems.map((item, idx) => {
            if (item.type === "message") {
              return (
                <MessageBubble 
                  key={`msg-${item.data.id}`} 
                  message={item.data} 
                  onImageClick={onImageClick}
                  currentHandlerName={currentHandlerName}
                />
              );
            } else {
              return (
                <SuggestionBubble
                  key={`suggestion-${idx}`}
                  suggestion={item.data}
                  formatDateTime={formatDateTime}
                />
              );
            }
          })
        )}
        
        {chatEndRef && <div ref={chatEndRef} />}
      </div>
    </div>
  );
}

interface SuggestionBubbleProps {
  suggestion: SuggestedResponse;
  formatDateTime: (date: string) => string;
}

function SuggestionBubble({ suggestion, formatDateTime }: SuggestionBubbleProps) {
  const [showArticles, setShowArticles] = useState(false);
  const hasArticles = suggestion.articles_used && suggestion.articles_used.length > 0;

  return (
    <div className="flex justify-end">
      <div className="max-w-[85%] rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl shadow-sm px-4 py-2 border-2 bg-gray-100 border-dashed border-gray-300">
        <div className="flex items-center gap-2 mb-1 relative">
          <Sparkles className="w-3 h-3 text-purple-500" />
          <span className="text-xs font-medium text-purple-600">
            Sugestão IA
          </span>
          {hasArticles && (
            <div className="relative">
              <button
                onClick={() => setShowArticles(!showArticles)}
                className="flex items-center gap-1 text-xs bg-purple-100 text-purple-700 hover:bg-purple-200 px-2 py-0.5 rounded-full transition-colors ml-1"
                title="Ver artigos usados"
              >
                <BookOpen className="w-3 h-3" />
                <span>{suggestion.articles_used!.length} artigo(s)</span>
              </button>
              
              {showArticles && (
                <div className="absolute right-0 bottom-full mb-2 z-50 bg-white border border-purple-200 rounded-lg shadow-xl p-3 min-w-[300px] max-w-[380px]">
                  <div className="flex items-center justify-between mb-2 pb-2 border-b border-purple-100">
                    <span className="text-sm font-semibold text-purple-800 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-purple-600" />
                      Artigos da Base de Conhecimento
                    </span>
                    <button
                      onClick={() => setShowArticles(false)}
                      className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestion.articles_used!.map((article) => (
                      <div
                        key={article.id}
                        className="p-2.5 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900">
                              {article.name}
                            </p>
                            <p className="text-xs text-purple-600 mt-0.5">
                              {article.product} • ID: {article.id}
                            </p>
                          </div>
                          {article.url && (
                            <a
                              href={article.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:text-purple-800 flex-shrink-0 p-1 hover:bg-purple-200 rounded"
                              title="Abrir artigo"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-sm whitespace-pre-wrap break-words text-gray-700">
          {suggestion.text}
        </p>
        <p className="text-[10px] mt-1 text-right text-gray-500">
          {formatDateTime(suggestion.created_at)}
        </p>
      </div>
    </div>
  );
}
