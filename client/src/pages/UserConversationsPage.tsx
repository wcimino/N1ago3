import { useState, useEffect, useRef, type KeyboardEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { RefreshCw, XCircle, MessageCircle, ChevronLeft, Sparkles, Clock, Package, Target, MessageSquare } from "lucide-react";
import type { UserConversationsMessagesResponse, ImagePayload, ConversationSummary } from "../types";
import { MessageBubble } from "../components/ui/MessageBubble";
import { ImageLightbox } from "../components/ui/ImageLightbox";
import { fetchApi } from "../lib/queryClient";
import { formatDateTimeShort } from "../lib/dateUtils";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface UserConversationsPageProps {
  params: { userId: string };
}

const intentLabels: Record<string, string> = {
  contratar: "Quer contratar",
  suporte: "Precisa de suporte",
  cancelar: "Quer cancelar",
  duvida: "Tem dúvidas",
  reclamacao: "Reclamação",
  outros: "Outros",
};

const intentColors: Record<string, string> = {
  contratar: "bg-green-100 text-green-700",
  suporte: "bg-blue-100 text-blue-700",
  cancelar: "bg-red-100 text-red-700",
  duvida: "bg-yellow-100 text-yellow-700",
  reclamacao: "bg-orange-100 text-orange-700",
  outros: "bg-gray-100 text-gray-700",
};

interface SummaryCardProps {
  summary: ConversationSummary | null;
  conversationId: string;
  conversationDate: string;
  conversationStatus: string;
  messagesCount: number;
  isSelected: boolean;
  onClick: () => void;
}

function SummaryCard({ 
  summary, 
  conversationId, 
  conversationDate, 
  conversationStatus,
  messagesCount,
  isSelected, 
  onClick 
}: SummaryCardProps) {
  const shortId = conversationId.slice(0, 8);
  const updatedAtDate = summary?.updated_at ? new Date(summary.updated_at) : null;
  const timeAgo = updatedAtDate 
    ? formatDistanceToNow(updatedAtDate, { addSuffix: true, locale: ptBR })
    : null;

  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick();
    }
  };

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
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${intentColors[summary.intent] || intentColors.outros}`}>
                <Target className="w-3 h-3" />
                {intentLabels[summary.intent] || summary.intent}
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

export function UserConversationsPage({ params }: UserConversationsPageProps) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const [expandedImage, setExpandedImage] = useState<ImagePayload | null>(null);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [selectedConversationIndex, sortedConversations]);

  const totalMessages = data?.conversations.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;
  const selectedConversation = sortedConversations[selectedConversationIndex];

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

      <div className="flex-1 bg-gray-100 overflow-hidden">
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
          <div className="h-full flex flex-col lg:flex-row">
            {/* Seção de Resumos - Esquerda em desktop (60%), topo em mobile */}
            <div className="lg:flex-[3] bg-white border-b lg:border-b-0 lg:border-r border-gray-200 flex flex-col">
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

            {/* Seção de Chat - Direita em desktop (40%), baixo em mobile */}
            <div className="lg:flex-[2] flex flex-col min-h-0">
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
