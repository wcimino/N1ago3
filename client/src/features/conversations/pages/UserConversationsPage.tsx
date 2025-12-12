import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { XCircle, MessageCircle, ChevronLeft, FileText, Eye, EyeOff, ArrowRightLeft, Zap, ZapOff, XSquare, Loader2 } from "lucide-react";
import type { UserConversationsMessagesResponse, ImagePayload } from "../../../types";
import { ImageLightbox, LoadingState, SegmentedTabs } from "../../../shared/components/ui";
import { HandlerBadge } from "../../../shared/components/badges/HandlerBadge";
import { ConversationSelector, ConversationSummary, ConversationChat, TransferConversationModal } from "../components";
import { useResizablePanel, useDateFormatters } from "../../../shared/hooks";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { getUserDisplayNameFromProfile } from "../../../lib/userUtils";

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
  const [contentTab, setContentTab] = useState<ContentTab>("resumo");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const hasInitializedSelection = useRef(false);
  
  const { containerRef, leftPanelWidth, isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: 35,
    minWidth: 25,
    maxWidth: 50,
  });

  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery<UserConversationsMessagesResponse>({
    queryKey: ["user-conversations-messages", userId],
    queryFn: () => fetchApi<UserConversationsMessagesResponse>(
      `/api/conversations/user/${encodeURIComponent(userId)}/messages`
    ),
    refetchInterval: 10000,
  });

  const toggleAutopilotMutation = useMutation({
    mutationFn: async ({ conversationId, enabled }: { conversationId: number; enabled: boolean }) => {
      return apiRequest("PATCH", `/api/conversations/${conversationId}/autopilot`, { enabled });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-conversations-messages", userId] });
    },
  });

  const closeConversationMutation = useMutation({
    mutationFn: async (conversationId: number) => {
      return apiRequest("POST", `/api/conversations/${conversationId}/close`, { reason: "manual" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-conversations-messages", userId] });
    },
    onError: (error: Error) => {
      alert(`Erro ao encerrar conversa: ${error.message}`);
    },
  });

  const sortedConversations = data?.conversations
    ? [...data.conversations].sort((a, b) => 
        new Date(b.conversation.created_at).getTime() - new Date(a.conversation.created_at).getTime()
      )
    : [];

  useEffect(() => {
    hasInitializedSelection.current = false;
    setSelectedConversationIndex(0);
    setContentTab("resumo");
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

  const renderActionButtons = () => {
    if (!selectedConversation) return null;
    return (
      <>
        <HandlerBadge 
          handlerName={selectedConversation.conversation.current_handler_name} 
          size="sm" 
        />
        {selectedConversation.conversation.current_handler_name?.startsWith("n1ago") && (
          <button
            onClick={() => toggleAutopilotMutation.mutate({
              conversationId: selectedConversation.conversation.id,
              enabled: !selectedConversation.conversation.autopilot_enabled,
            })}
            disabled={toggleAutopilotMutation.isPending}
            className={`inline-flex items-center justify-center w-8 h-8 text-sm border rounded-lg transition-colors ${
              selectedConversation.conversation.autopilot_enabled
                ? "text-amber-600 hover:text-amber-700 border-amber-200 hover:border-amber-300 hover:bg-amber-50"
                : "text-green-600 hover:text-green-700 border-green-200 hover:border-green-300 hover:bg-green-50"
            }`}
            title={selectedConversation.conversation.autopilot_enabled ? "Pausar AutoPilot" : "Ativar AutoPilot"}
          >
            {selectedConversation.conversation.autopilot_enabled ? (
              <ZapOff className="w-4 h-4" />
            ) : (
              <Zap className="w-4 h-4" />
            )}
          </button>
        )}
        <button
          onClick={() => setShowTransferModal(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 border border-purple-200 hover:border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
          title="Transferir conversa"
        >
          <ArrowRightLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Transferir</span>
        </button>
        {selectedConversation.conversation.status === "active" && (
          <button
            onClick={() => {
              if (confirm("Tem certeza que deseja encerrar esta conversa?")) {
                closeConversationMutation.mutate(selectedConversation.conversation.id);
              }
            }}
            disabled={closeConversationMutation.isPending}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg hover:bg-red-50 transition-colors"
            title="Encerrar conversa"
          >
            {closeConversationMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XSquare className="w-4 h-4" />
            )}
            <span className="hidden sm:inline">Encerrar</span>
          </button>
        )}
      </>
    );
  };

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

  return (
    <div className="h-[calc(100vh-180px)] flex flex-col">
      <div className="bg-white rounded-t-lg shadow-sm border-b px-3 sm:px-4 py-2 sm:py-3 flex-shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => navigate("/atendimentos")}
            className="inline-flex items-center gap-1 text-gray-600 hover:text-gray-900 flex-shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-900 truncate">{customerName}</h2>
            <p className="text-xs text-gray-500 truncate">
              {data?.conversations.length || 0} {(data?.conversations.length || 0) === 1 ? "conversa" : "conversas"} - {totalMessages} msg
            </p>
          </div>
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
              <ConversationSelector
                selectedIndex={selectedConversationIndex}
                totalCount={sortedConversations.length}
                formattedDate={selectedConversation && formatDateTimeShort(selectedConversation.conversation.created_at)}
                isActive={selectedConversation?.conversation.status === "active"}
                closedReason={selectedConversation?.conversation.closed_reason}
                onPrevious={goToPreviousConversation}
                onNext={goToNextConversation}
                actionButtons={renderActionButtons()}
              />
              
              <div className="px-3 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                <div className="flex items-center justify-between">
                  <SegmentedTabs
                    tabs={contentTabs}
                    activeTab={contentTab}
                    onChange={(tab) => setContentTab(tab as ContentTab)}
                    iconOnlyMobile
                  />
                  {contentTab === "chat" && (
                    <button
                      onClick={() => setShowSuggestions(!showSuggestions)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors ml-2"
                    >
                      {showSuggestions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span className="hidden xs:inline">{showSuggestions ? "Ocultar" : "Exibir"}</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 flex flex-col overflow-hidden bg-gray-50">
                {contentTab === "resumo" && (
                  <ConversationSummary summary={selectedConversation?.summary} />
                )}
                {contentTab === "chat" && (
                  <ConversationChat
                    messages={selectedConversation?.messages || []}
                    suggestedResponses={
                      showSuggestions 
                        ? (selectedConversation?.suggested_responses || [])
                        : []
                    }
                    onImageClick={setExpandedImage}
                    formatDateTime={formatDateTimeShort}
                    chatEndRef={chatEndRef}
                    currentHandlerName={selectedConversation?.conversation.current_handler_name}
                  />
                )}
              </div>
            </div>

            {/* Desktop Layout - Split Panels */}
            <div className="hidden lg:flex h-full flex-col overflow-hidden">
              <ConversationSelector
                selectedIndex={selectedConversationIndex}
                totalCount={sortedConversations.length}
                formattedDate={selectedConversation && formatDateTimeShort(selectedConversation.conversation.created_at)}
                isActive={selectedConversation?.conversation.status === "active"}
                closedReason={selectedConversation?.conversation.closed_reason}
                onPrevious={goToPreviousConversation}
                onNext={goToNextConversation}
                actionButtons={renderActionButtons()}
              />
              
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
                  <ConversationSummary summary={selectedConversation?.summary} />
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
                  <div className="px-4 py-2 bg-white border-b border-gray-200 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-600" />
                      <span className="text-sm font-medium text-gray-700">Chat</span>
                    </div>
                    <button
                      onClick={() => setShowSuggestions(!showSuggestions)}
                      className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      {showSuggestions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      <span>{showSuggestions ? "Ocultar" : "Exibir"} Sugestões</span>
                    </button>
                  </div>
                  <ConversationChat
                    messages={selectedConversation?.messages || []}
                    suggestedResponses={
                      showSuggestions 
                        ? (selectedConversation?.suggested_responses || [])
                        : []
                    }
                    onImageClick={setExpandedImage}
                    formatDateTime={formatDateTimeShort}
                    chatEndRef={chatEndRef}
                    currentHandlerName={selectedConversation?.conversation.current_handler_name}
                  />
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

      {selectedConversation && (
        <TransferConversationModal
          isOpen={showTransferModal}
          onClose={() => setShowTransferModal(false)}
          conversationId={selectedConversation.conversation.id}
          currentHandler={selectedConversation.conversation.current_handler_name}
        />
      )}
    </div>
  );
}
