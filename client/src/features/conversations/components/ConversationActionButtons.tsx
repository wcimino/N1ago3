import { ArrowRightLeft, XSquare, Loader2 } from "lucide-react";
import { HandlerBadge } from "../../../shared/components/badges/HandlerBadge";
import { FavoriteButton } from "../../favorites/components/FavoriteButton";
import { AutopilotToggleButton } from "./AutopilotToggleButton";
import { ActionsDropdown } from "./ActionsDropdown";

interface ConversationActionButtonsProps {
  conversationId: number;
  handlerName: string | null;
  autopilotEnabled: boolean;
  isActive: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isFavoriteLoading: boolean;
  onToggleAutopilot: () => void;
  isAutopilotLoading: boolean;
  onTransfer: () => void;
  onClose: () => void;
  isClosing: boolean;
  variant: "desktop" | "mobile";
}

export function ConversationActionButtons({
  conversationId,
  handlerName,
  autopilotEnabled,
  isActive,
  isFavorite,
  onToggleFavorite,
  isFavoriteLoading,
  onToggleAutopilot,
  isAutopilotLoading,
  onTransfer,
  onClose,
  isClosing,
  variant,
}: ConversationActionButtonsProps) {
  const showAutopilot = handlerName?.startsWith("n1ago") || false;

  if (variant === "mobile") {
    return (
      <ActionsDropdown
        conversationId={conversationId}
        isFavorite={isFavorite}
        onToggleFavorite={onToggleFavorite}
        isFavoriteLoading={isFavoriteLoading}
        handlerName={handlerName}
        autopilotEnabled={autopilotEnabled}
        onToggleAutopilot={onToggleAutopilot}
        isAutopilotLoading={isAutopilotLoading}
        showAutopilot={showAutopilot}
        isActive={isActive}
        onTransfer={onTransfer}
        onClose={onClose}
        isClosing={isClosing}
      />
    );
  }

  return (
    <>
      <FavoriteButton
        conversationId={conversationId}
        isFavorite={isFavorite}
        onToggle={onToggleFavorite}
        isLoading={isFavoriteLoading}
        size="sm"
      />
      <HandlerBadge 
        handlerName={handlerName} 
        size="sm" 
      />
      {showAutopilot && (
        <AutopilotToggleButton
          enabled={autopilotEnabled}
          onToggle={onToggleAutopilot}
          isLoading={isAutopilotLoading}
        />
      )}
      <button
        onClick={onTransfer}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-purple-600 hover:text-purple-700 border border-purple-200 hover:border-purple-300 rounded-lg hover:bg-purple-50 transition-colors"
        title="Transferir conversa"
      >
        <ArrowRightLeft className="w-4 h-4" />
        <span className="hidden sm:inline">Transferir</span>
      </button>
      {isActive && (
        <button
          onClick={onClose}
          disabled={isClosing}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-lg hover:bg-red-50 transition-colors"
          title="Encerrar conversa"
        >
          {isClosing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <XSquare className="w-4 h-4" />
          )}
          <span className="hidden sm:inline">Encerrar</span>
        </button>
      )}
    </>
  );
}
