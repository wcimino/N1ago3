import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { XCircle, MessageCircle, FileText, Eye, EyeOff } from "lucide-react";
import type { ImagePayload } from "../../../types";
import { ImageLightbox, LoadingState, SegmentedTabs, ConfirmModal, EmptyState, SectionHeader } from "../../../shared/components/ui";
import { ConversationSelector, ConversationSummary, ConversationChat, TransferConversationModal, CustomerHeader, ConversationActionButtons } from "../components";
import { useResizablePanel, useDateFormatters, useConfirmation } from "../../../shared/hooks";
import { getUserDisplayNameFromProfile } from "../../../lib/userUtils";
import { useFavorites } from "../../favorites/hooks/useFavorites";
import { useUserConversations } from "../hooks";

interface UserConversationsPageProps {
  params: { userId: string; conversationId?: string };
}

type ContentTab = "resumo" | "chat";

export function UserConversationsPage({ params }: UserConversationsPageProps) {
  const [, navigate] = useLocation();
  const userId = decodeURIComponent(params.userId);
  const conversationIdFromUrl = params.conversationId ? parseInt(params.conversationId, 10) : null;
  const { formatDateTimeShort } = useDateFormatters();
  const confirmation = useConfirmation();
  const [expandedImage, setExpandedImage] = useState<ImagePayload | null>(null);
  const [contentTab, setContentTab] = useState<ContentTab>("resumo");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  
  const { containerRef, leftPanelWidth, isResizing, handleMouseDown } = useResizablePanel({
    initialWidth: 35,
    minWidth: 25,
    maxWidth: 50,
  });

  const { isFavorite, toggleFavorite, isToggling } = useFavorites();

  const {
    data,
    isLoading,
    error,
    sortedConversations,
    selectedConversation,
    selectedConversationIndex,
    totalMessages,
    userProfile,
    goToPreviousConversation,
    goToNextConversation,
    toggleAutopilot,
    isTogglingAutopilot,
    closeConversation,
    isClosingConversation,
  } = useUserConversations({ userId, conversationIdFromUrl });

  useEffect(() => {
    setContentTab("resumo");
  }, [userId]);

  const customerName = getUserDisplayNameFromProfile(userProfile, userId);

  const contentTabs = [
    { id: "resumo", label: "Resumo", icon: <FileText className="w-4 h-4" /> },
    { id: "chat", label: "Chat", icon: <MessageCircle className="w-4 h-4" /> },
  ];

  const handleCloseConversation = () => {
    if (!selectedConversation) return;
    confirmation.confirm({
      title: "Encerrar conversa",
      message: "Tem certeza que deseja encerrar esta conversa?",
      confirmLabel: "Encerrar",
      variant: "warning",
      onConfirm: () => closeConversation(selectedConversation.conversation.id),
    });
  };

  const actionButtonProps = selectedConversation ? {
    conversationId: selectedConversation.conversation.id,
    handlerName: selectedConversation.conversation.current_handler_name,
    autopilotEnabled: selectedConversation.conversation.autopilot_enabled,
    isActive: selectedConversation.conversation.status === "active",
    isFavorite: isFavorite(selectedConversation.conversation.id),
    onToggleFavorite: () => toggleFavorite(selectedConversation.conversation.id),
    isFavoriteLoading: isToggling,
    onToggleAutopilot: () => toggleAutopilot(
      selectedConversation.conversation.id,
      !selectedConversation.conversation.autopilot_enabled
    ),
    isAutopilotLoading: isTogglingAutopilot,
    onTransfer: () => setShowTransferModal(true),
    onClose: handleCloseConversation,
    isClosing: isClosingConversation,
  } : null;

  return (
    <div className="h-full min-h-0 flex flex-col">
      <div className="hidden lg:block flex-shrink-0">
        <CustomerHeader
          name={customerName}
          conversationCount={data?.conversations.length || 0}
          messageCount={totalMessages}
          onBack={() => navigate("/atendimentos")}
          rounded
        />
      </div>

      <div className="flex-1 bg-gray-100 overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <LoadingState message="Carregando conversas..." />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<XCircle className="w-12 h-12 text-red-300" />}
              title="Conversas não encontradas"
              action={
                <button
                  onClick={() => navigate("/atendimentos")}
                  className="text-blue-600 hover:text-blue-800"
                >
                  Voltar para lista
                </button>
              }
            />
          </div>
        ) : !data?.conversations || data.conversations.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <EmptyState
              icon={<MessageCircle className="w-12 h-12 text-gray-300" />}
              title="Nenhuma mensagem encontrada"
            />
          </div>
        ) : (
          <>
            {/* Mobile Layout */}
            <div className="lg:hidden flex-1 flex flex-col min-h-0">
              <div className="sticky top-0 z-10 bg-white flex-shrink-0">
                <CustomerHeader
                  name={customerName}
                  conversationCount={data?.conversations.length || 0}
                  messageCount={totalMessages}
                  onBack={() => navigate("/atendimentos")}
                  compact
                />
                
                <ConversationSelector
                  selectedIndex={selectedConversationIndex}
                  totalCount={sortedConversations.length}
                  formattedDate={selectedConversation && formatDateTimeShort(selectedConversation.conversation.created_at)}
                  isActive={selectedConversation?.conversation.status === "active"}
                  closedReason={selectedConversation?.conversation.closed_reason}
                  onPrevious={goToPreviousConversation}
                  onNext={goToNextConversation}
                  actionButtons={actionButtonProps && (
                    <ConversationActionButtons {...actionButtonProps} variant="mobile" />
                  )}
                />
                
                <div className="px-3 py-2 border-b border-gray-200">
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
              </div>

              <div className="flex-1 overflow-y-auto min-h-0 bg-gray-50">
                {contentTab === "resumo" && (
                  <ConversationSummary 
                    summary={selectedConversation?.summary} 
                    conversationId={selectedConversation?.conversation.id}
                  />
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

            {/* Desktop Layout */}
            <div className="hidden lg:flex h-full flex-col overflow-hidden">
              <div 
                ref={containerRef}
                className="flex-1 flex overflow-hidden"
              >
                <div 
                  className="flex flex-col overflow-hidden bg-white border-r border-gray-200"
                  style={{ width: `${leftPanelWidth}%` }}
                >
                  <ConversationSelector
                    selectedIndex={selectedConversationIndex}
                    totalCount={sortedConversations.length}
                    formattedDate={selectedConversation && formatDateTimeShort(selectedConversation.conversation.created_at)}
                    isActive={selectedConversation?.conversation.status === "active"}
                    closedReason={selectedConversation?.conversation.closed_reason}
                    onPrevious={goToPreviousConversation}
                    onNext={goToNextConversation}
                  />
                  
                  <SectionHeader
                    icon={<FileText className="w-4 h-4 text-purple-600" />}
                    title="Resumo"
                  />
                  <div className="flex-1 overflow-y-auto min-h-0">
                    <ConversationSummary 
                      summary={selectedConversation?.summary} 
                      conversationId={selectedConversation?.conversation.id}
                    />
                  </div>
                </div>

                <div
                  className={`w-1 cursor-col-resize hover:bg-blue-400 transition-colors flex-shrink-0 ${
                    isResizing ? "bg-blue-500" : "bg-gray-200"
                  }`}
                  onMouseDown={handleMouseDown}
                />

                <div 
                  className="flex-1 flex flex-col overflow-hidden bg-gray-50"
                  style={{ width: `${100 - leftPanelWidth}%` }}
                >
                  <SectionHeader
                    icon={<MessageCircle className="w-4 h-4 text-blue-600" />}
                    title="Chat"
                    className="bg-white"
                    actions={
                      <>
                        {actionButtonProps && (
                          <ConversationActionButtons {...actionButtonProps} variant="desktop" />
                        )}
                        <button
                          onClick={() => setShowSuggestions(!showSuggestions)}
                          className="flex items-center gap-1 px-2 py-1.5 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-lg transition-colors"
                        >
                          {showSuggestions ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span>{showSuggestions ? "Ocultar" : "Sugestões"}</span>
                        </button>
                      </>
                    }
                  />
                  <div className="flex-1 overflow-y-auto min-h-0">
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

      <ConfirmModal
        isOpen={confirmation.isOpen}
        onClose={confirmation.close}
        onConfirm={confirmation.handleConfirm}
        title={confirmation.title}
        message={confirmation.message}
        confirmLabel={confirmation.confirmLabel}
        cancelLabel={confirmation.cancelLabel}
        variant={confirmation.variant}
      />
    </div>
  );
}
