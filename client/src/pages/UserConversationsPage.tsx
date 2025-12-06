import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { XCircle, MessageCircle, ChevronLeft, Sparkles } from "lucide-react";
import type { UserConversationsMessagesResponse, ImagePayload } from "../types";
import { MessageBubble } from "../components/ui/MessageBubble";
import { ImageLightbox } from "../components/ui/ImageLightbox";
import { LoadingState } from "../components/ui/LoadingSpinner";
import { SummaryCard } from "../components/SummaryCard";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { fetchApi } from "../lib/queryClient";
import { formatDateTimeShort } from "../lib/dateUtils";

interface UserConversationsPageProps {
  params: { userId: string };
}

export function UserConversationsPage({ params }: UserConversationsPageProps) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const [expandedImage, setExpandedImage] = useState<ImagePayload | null>(null);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const { containerRef, leftPanelWidth, isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: 60,
    minWidth: 30,
    maxWidth: 70,
  });

  const { data, isLoading, error } = useQuery<UserConversationsMessagesResponse>({
    queryKey: ["user-conversations-messages", userId],
    queryFn: () => fetchApi<UserConversationsMessagesResponse>(
      `/api/conversations/user/${encodeURIComponent(userId)}/messages`
    ),
  });

  const sortedConversations = data?.conversations
    ? [...data.conversations].sort((a, b) => 
        new Date(b.conversation.created_at).getTime() - new Date(a.conversation.created_at).getTime()
      )
    : [];

  useEffect(() => {
    if (sortedConversations.length > 0) {
      setSelectedConversationIndex(0);
    }
  }, [data]);


  const totalMessages = data?.conversations.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;
  const selectedConversation = sortedConversations[selectedConversationIndex];

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="bg-white rounded-t-lg shadow-sm border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate("/users")}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">Histórico do Usuário</h2>
          <p className="text-xs text-gray-500">
            {data?.conversations.length || 0} {(data?.conversations.length || 0) === 1 ? "conversa" : "conversas"} - {totalMessages} {totalMessages === 1 ? "mensagem" : "mensagens"}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingState message="Carregando conversas..." />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <XCircle className="w-12 h-12 text-red-300 mb-3" />
            <p>Conversas não encontradas</p>
            <button
              onClick={() => navigate("/users")}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Voltar para lista
            </button>
          </div>
        ) : !data?.conversations || data.conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageCircle className="w-12 h-12 text-gray-300 mb-3" />
            <p>Nenhuma mensagem encontrada</p>
          </div>
        ) : (
          <div ref={containerRef} className={`h-full flex flex-col lg:flex-row overflow-hidden ${isResizing ? 'select-none' : ''}`}>
            {/* Seção de Resumos - Esquerda em desktop, topo em mobile */}
            <div 
              className="bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col lg:h-full w-full lg:w-auto lg:flex-shrink-0"
              style={{ flex: `0 0 ${leftPanelWidth}%` }}
            >
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">Resumos das Conversas</h3>
                </div>
                <p className="text-xs text-purple-600 mt-1">
                  Clique em uma conversa para ver as mensagens
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto p-3 space-y-3 max-h-[200px] lg:max-h-none">
                {sortedConversations.map((convItem, index) => (
                  <SummaryCard
                    key={convItem.conversation.id}
                    summary={convItem.summary}
                    conversationId={convItem.conversation.zendesk_conversation_id}
                    conversationDate={convItem.conversation.created_at}
                    conversationStatus={convItem.conversation.status}
                    messagesCount={convItem.messages.length}
                    isSelected={selectedConversationIndex === index}
                    onClick={() => setSelectedConversationIndex(index)}
                  />
                ))}
              </div>
            </div>

            {/* Resize Handle - Visível apenas em desktop */}
            <div
              className="hidden lg:flex w-2 cursor-col-resize items-center justify-center bg-gray-100 hover:bg-purple-200 transition-colors group"
              onMouseDown={handleMouseDown}
            >
              <div className="w-0.5 h-8 bg-gray-300 group-hover:bg-purple-400 rounded-full" />
            </div>

            {/* Seção de Chat - Direita em desktop, baixo em mobile */}
            <div className="flex-1 flex flex-col min-h-0 lg:h-full overflow-hidden">
              {selectedConversation && (
                <>
                  <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center gap-3">
                    <MessageCircle className="w-5 h-5 text-blue-600" />
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Conversa {selectedConversation.conversation.zendesk_conversation_id.slice(0, 8)}...
                      </h3>
                      <p className="text-xs text-gray-500">
                        {formatDateTimeShort(selectedConversation.conversation.created_at)}
                        <span 
                          className="ml-2 cursor-pointer hover:text-gray-700"
                          title="Clique para copiar o ID completo"
                          onClick={() => {
                            navigator.clipboard.writeText(selectedConversation.conversation.zendesk_conversation_id);
                          }}
                        >
                          (clique para copiar ID completo)
                        </span>
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
                    <div className="space-y-3 max-w-2xl mx-auto">
                      {selectedConversation.messages.length === 0 ? (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          Nenhuma mensagem nesta conversa
                        </div>
                      ) : (
                        selectedConversation.messages.map((msg) => (
                          <MessageBubble 
                            key={msg.id} 
                            message={msg} 
                            onImageClick={setExpandedImage}
                          />
                        ))
                      )}
                      
                      {selectedConversation.suggested_response && (
                        <div className="flex justify-end">
                          <div className="max-w-[75%] bg-gray-200 opacity-60 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl shadow-sm px-4 py-2 border-2 border-dashed border-gray-300">
                            <div className="flex items-center gap-2 mb-1">
                              <Sparkles className="w-3 h-3 text-gray-500" />
                              <span className="text-xs font-medium text-gray-500">
                                Sugestão IA (não enviada)
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 whitespace-pre-wrap break-words">
                              {selectedConversation.suggested_response.text}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-1 text-right">
                              {formatDateTimeShort(selectedConversation.suggested_response.created_at)}
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div ref={chatEndRef} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      <ImageLightbox
        imageUrl={expandedImage?.mediaUrl || null}
        altText={expandedImage?.altText}
        onClose={() => setExpandedImage(null)}
      />
    </div>
  );
}
