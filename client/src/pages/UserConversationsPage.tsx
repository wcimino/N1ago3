import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RefreshCw, XCircle, MessageCircle, ChevronLeft } from "lucide-react";
import type { UserConversationsMessagesResponse, ImagePayload } from "../types";
import { ConversationSummaryCard } from "../components";
import { MessageBubble } from "../components/ui/MessageBubble";
import { ImageLightbox } from "../components/ui/ImageLightbox";
import { fetchApi } from "../lib/queryClient";
import { formatDateTimeShort } from "../lib/dateUtils";

interface UserConversationsPageProps {
  params: { userId: string };
}

export function UserConversationsPage({ params }: UserConversationsPageProps) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const [expandedImage, setExpandedImage] = useState<ImagePayload | null>(null);

  const { data, isLoading, error } = useQuery<UserConversationsMessagesResponse>({
    queryKey: ["user-conversations-messages", userId],
    queryFn: () => fetchApi<UserConversationsMessagesResponse>(
      `/api/conversations/user/${encodeURIComponent(userId)}/messages`
    ),
  });

  const totalMessages = data?.conversations.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="bg-white rounded-t-lg shadow-sm border-b px-4 py-3 flex items-center gap-3">
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

      <div className="flex-1 bg-gray-100 overflow-y-auto p-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
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
          <div className="space-y-4 max-w-3xl mx-auto">
            {data.conversations.map((convItem, convIndex) => (
              <div key={convItem.conversation.id}>
                <div className="flex items-center gap-3 my-6">
                  <div className="flex-1 h-px bg-gray-300"></div>
                  <div className="flex flex-col items-center px-4 py-2 bg-white rounded-xl shadow-sm border">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">
                        Conversa #{convIndex + 1}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatDateTimeShort(convItem.conversation.created_at)}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        convItem.conversation.status === "active" 
                          ? "bg-green-100 text-green-700" 
                          : "bg-gray-100 text-gray-600"
                      }`}>
                        {convItem.conversation.status}
                      </span>
                    </div>
                    <span 
                      className="text-[10px] text-gray-400 cursor-pointer hover:text-gray-600 mt-1"
                      title="Clique para copiar o ID"
                      onClick={() => {
                        navigator.clipboard.writeText(convItem.conversation.zendesk_conversation_id);
                      }}
                    >
                      {convItem.conversation.zendesk_conversation_id}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-gray-300"></div>
                </div>

                <ConversationSummaryCard summary={convItem.summary} />

                <div className="space-y-3">
                  {convItem.messages.length === 0 ? (
                    <div className="text-center py-4 text-gray-400 text-sm">
                      Nenhuma mensagem nesta conversa
                    </div>
                  ) : (
                    convItem.messages.map((msg) => (
                      <MessageBubble 
                        key={msg.id} 
                        message={msg} 
                        onImageClick={setExpandedImage}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
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
