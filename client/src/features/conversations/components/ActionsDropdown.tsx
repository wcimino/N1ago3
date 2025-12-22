import { useState, useRef, useEffect } from "react";
import { MoreVertical, Star, ArrowRightLeft, Zap, ZapOff, XSquare, Loader2 } from "lucide-react";
import { HandlerBadge } from "../../../shared/components/badges/HandlerBadge";

interface ActionsDropdownProps {
  conversationId: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  isFavoriteLoading: boolean;
  handlerName?: string | null;
  autopilotEnabled: boolean;
  onToggleAutopilot: () => void;
  isAutopilotLoading: boolean;
  showAutopilot: boolean;
  isActive: boolean;
  onTransfer: () => void;
  onClose: () => void;
  isClosing: boolean;
}

export function ActionsDropdown({
  conversationId,
  isFavorite,
  onToggleFavorite,
  isFavoriteLoading,
  handlerName,
  autopilotEnabled,
  onToggleAutopilot,
  isAutopilotLoading,
  showAutopilot,
  isActive,
  onTransfer,
  onClose,
  isClosing,
}: ActionsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-lg border border-gray-400 hover:border-gray-500 hover:bg-gray-100 transition-colors"
        title="Ações"
      >
        <MoreVertical className="w-4 h-4 text-gray-600" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
          {handlerName && (
            <div className="px-3 py-2 border-b border-gray-100">
              <span className="text-xs text-gray-500">Atendente</span>
              <div className="mt-1">
                <HandlerBadge handlerName={handlerName} size="sm" />
              </div>
            </div>
          )}

          <button
            onClick={() => {
              onToggleFavorite();
              setIsOpen(false);
            }}
            disabled={isFavoriteLoading}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <Star className={`w-4 h-4 ${isFavorite ? "text-amber-500 fill-amber-500" : "text-gray-400"}`} />
            {isFavorite ? "Remover favorito" : "Adicionar favorito"}
          </button>

          {showAutopilot && (
            <button
              onClick={() => {
                onToggleAutopilot();
                setIsOpen(false);
              }}
              disabled={isAutopilotLoading}
              className={`w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                autopilotEnabled
                  ? "text-amber-600 hover:bg-amber-50"
                  : "text-green-600 hover:bg-green-50"
              }`}
            >
              {autopilotEnabled ? (
                <>
                  <ZapOff className="w-4 h-4" />
                  Pausar AutoPilot
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4" />
                  Ativar AutoPilot
                </>
              )}
            </button>
          )}

          <button
            onClick={() => {
              onTransfer();
              setIsOpen(false);
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 transition-colors"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Transferir conversa
          </button>

          {isActive && (
            <button
              onClick={() => {
                onClose();
                setIsOpen(false);
              }}
              disabled={isClosing}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              {isClosing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XSquare className="w-4 h-4" />
              )}
              Encerrar conversa
            </button>
          )}
        </div>
      )}
    </div>
  );
}
