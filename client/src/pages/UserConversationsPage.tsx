import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { XCircle, MessageCircle, ChevronLeft, ChevronRight, Sparkles, FileText } from "lucide-react";
import type { UserConversationsMessagesResponse, ImagePayload } from "../types";
import { MessageBubble } from "../components/ui/MessageBubble";
import { ImageLightbox } from "../components/ui/ImageLightbox";
import { LoadingState } from "../components/ui/LoadingSpinner";
import { SegmentedTabs } from "../components/ui/SegmentedTabs";
import { useResizablePanel } from "../hooks/useResizablePanel";
import { useDateFormatters } from "../hooks/useDateFormatters";
import { fetchApi } from "../lib/queryClient";
import { getUserDisplayNameFromProfile } from "../lib/userUtils";

interface UserConversationsPageProps {
  params: { userId: string };
}

type ContentTab = "resumo" | "chat";

export function UserConversationsPage({ params }: UserConversationsPageProps) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const { formatDateTimeShort } = useDateFormatters();
  const [expandedImage, setExpandedImage] = useState<ImagePayload | null>(null);
  const [selectedConversationIndex, setSelectedConversationIndex] = useState(0);
  const [contentTab, setContentTab] = useState<ContentTab>("chat");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasInitializedSelection = useRef(false);
  
  const { containerRef, leftPanelWidth, isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: 35,
    minWidth: 25,
    maxWidth: 50,
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
    hasInitializedSelection.current = false;
    setSelectedConversationIndex(0);
    setContentTab("chat");
  }, [userId]);

  useEffect(() => {
    if (sortedConversations.length > 0 && !hasInitializedSelection.current) {
      setSelectedConversationIndex(0);
      hasInitializedSelection.current = true;
    }
    if (sortedConversations.length > 0 && selectedConversationIndex >= sortedConversations.length) {
      setSelectedConversationIndex(sortedConversations.length - 1);
    }
  }, [sortedConversations.length, selectedConversationIndex]);

  const totalMessages = data?.conversations.reduce((acc, conv) => acc + conv.messages.length, 0) || 0;
  const selectedConversation = sortedConversations[selectedConversationIndex];
  const customerName = getUserDisplayNameFromProfile(data?.user_profile, userId);

  const contentTabs = [
    { id: "resumo", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
    { id: "chat", label: "Chat", icon: <MessageCircle className="w-4 h-4" /> },
  ];

  const goToPreviousConversation = () => {
    if (selectedConversationIndex > 0) {
      setSelectedConversationIndex(selectedConversationIndex - 1);
    }
  };

  const goToNextConversation = () => {
    if (selectedConversationIndex < sortedConversations.length - 1) {
      setSelectedConversationIndex(selectedConversationIndex + 1);
    }
  };

  const renderConversationSelector = () => (
    <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-200">
      <button
        onClick={goToPreviousConversation}
        disabled={selectedConversationIndex === 0}
        className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-gray-600" />
      </button>
      
      <div className="flex-1 text-center">
        <p className="text-sm font-medium text-gray-900">
          Conversa {selectedConversationIndex + 1} de {sortedConversations.length}
        </p>
        <p className="text-xs text-gray-500">
          {selectedConversation && formatDateTimeShort(selectedConversation.conversation.created_at)}
          {selectedConversation?.conversation.status === "active" && (
            <span className="ml-2 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-xs">
              ativa
            </span>
          )}
        </p>
      </div>
      
      <button
        onClick={goToNextConversation}
        disabled={selectedConversationIndex === sortedConversations.length - 1}
        className="p-2 rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-gray-600" />
      </button>
    </div>
  );

  const renderSummary = () => (
    <div className="flex-1 overflow-y-auto p-4">
      {selectedConversation?.summary ? (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="w-5 h-5 text-purple-600" />
            <h3 className="font-semibold text-purple-900">Resumo da Conversa</h3>
          </div>
          
          <div className="space-y-3">
            {selectedConversation.summary.product && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Produto:</span>
                <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-sm font-medium">
                  {selectedConversation.summary.product}
                </span>
              </div>
            )}
            
            {selectedConversation.summary.intent && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Intenção:</span>
                <span className="px-2 py-0.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                  {selectedConversation.summary.intent}
                </span>
              </div>
            )}
            
            {selectedConversation.summary.confidence !== null && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500">Confiança:</span>
                <span className="text-sm font-medium text-gray-700">
                  {selectedConversation.summary.confidence}%
                </span>
              </div>
            )}
            
            <div className="pt-2 border-t border-gray-100">
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {selectedConversation.summary.text}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <Sparkles className="w-12 h-12 text-gray-300 mb-3" />
          <p>Resumo ainda não gerado</p>
        </div>
      )}
    </div>
  );

  const renderChat = () => (
    <div className="flex-1 overflow-y-auto p-4 bg-gray-50">
      <div className="space-y-3 max-w-2xl mx-auto">
        {selectedConversation?.messages.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            Nenhuma mensagem nesta conversa
          </div>
        ) : (
          selectedConversation?.messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              message={msg} 
              onImageClick={setExpandedImage}
            />
          ))
        )}
        
        {selectedConversation?.suggested_response && (
          <div className="flex justify-end">
            <div className="max-w-[85%] bg-gray-200 opacity-60 rounded-tl-2xl rounded-tr-sm rounded-br-2xl rounded-bl-2xl shadow-sm px-4 py-2 border-2 border-dashed border-gray-300">
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
  );

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="bg-white rounded-t-lg shadow-sm border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
        <button
          onClick={() => navigate("/atendimentos")}
          className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-900">{customerName}</h2>
          <p className="text-xs text-gray-500">
            {data?.conversations.length || 0} {(data?.conversations.length || 0) === 1 ? "conversa" : "conversas"} - {totalMessages} {totalMessages === 1 ? "mensagem" : "mensagens"}
          </p>
        </div>
      </div>

      <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingState message="Carregando conversas..." />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <XCircle className="w-12 h-12 text-red-300 mb-3" />
            <p>Conversas não encontradas</p>
            <button
              onClick={() => navigate("/atendimentos")}
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
          <>
            {/* Mobile Layout */}
            <div className="lg:hidden flex-1 flex flex-col overflow-hidden">
              {renderConversationSelector()}
              
              <div className="px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                <SegmentedTabs
                  tabs={contentTabs}
                  activeTab={contentTab}
                  onChange={(tab) => setContentTab(tab as ContentTab)}
                />
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {contentTab === "resumo" && renderSummary()}
                {contentTab === "chat" && renderChat()}
              </div>
            </div>

            {/* Desktop Layout - Split Panels */}
            <div className="hidden lg:flex h-full flex-col overflow-hidden">
              {renderConversationSelector()}
              
              <div 
                ref={containerRef}
                className="flex-1 flex overflow-hidden"
              >
                {/* Left Panel - Summary */}
                <div 
                  className="flex flex-col overflow-hidden bg-white border-r border-gray-200"
                  style={{ width: `${leftPanelWidth}%` }}
                >
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-purple-600" />
                    <span className="text-sm font-medium text-gray-700">Resumo</span>
                  </div>
                  {renderSummary()}
                </div>

                {/* Resize Handle */}
                <div
                  className={`w-1 cursor-col-resize hover:bg-blue-400 transition-colors flex-shrink-0 ${
                    isResizing ? "bg-blue-500" : "bg-gray-200"
                  }`}
                  onMouseDown={handleMouseDown}
                />

                {/* Right Panel - Chat */}
                <div 
                  className="flex-1 flex flex-col overflow-hidden bg-gray-50"
                  style={{ width: `${100 - leftPanelWidth}%` }}
                >
                  <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">Chat</span>
                  </div>
                  {renderChat()}
                </div>
              </div>
            </div>
          </>
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
