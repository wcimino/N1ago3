import { RefObject, useMemo } from "react";
import { Sparkles } from "lucide-react";
import { MessageBubble } from "../../../shared/components/ui/MessageBubble";
import type { ImagePayload, Message } from "../../../types";

interface SuggestedResponse {
  text: string;
  created_at: string;
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
}

export function ConversationChat({
  messages,
  suggestedResponses = [],
  onImageClick,
  formatDateTime,
  chatEndRef,
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
                />
              );
            } else {
              return (
                <div key={`suggestion-${idx}`} className="flex justify-end">
                  <div className="max-w-[85%] bg-gray-200 opacity-60 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl shadow-sm px-4 py-2 border-2 border-dashed border-gray-300">
                    <div className="flex items-center gap-2 mb-1">
                      <Sparkles className="w-3 h-3 text-gray-500" />
                      <span className="text-xs font-medium text-gray-500">
                        Sugestão IA (não enviada)
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                      {item.data.text}
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 text-right">
                      {formatDateTime(item.data.created_at)}
                    </p>
                  </div>
                </div>
              );
            }
          })
        )}
        
        {chatEndRef && <div ref={chatEndRef} />}
      </div>
    </div>
  );
}
