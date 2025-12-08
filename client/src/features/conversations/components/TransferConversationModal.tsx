import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { X, ArrowRight, Bot, Brain, UserCircle, Loader2 } from "lucide-react";

interface TransferConversationModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: number;
  currentHandler: string | null;
}

const TRANSFER_TARGETS = [
  { id: "n1ago", label: "N1ago", icon: Brain, bgClass: "bg-purple-100", iconClass: "text-purple-600", handlerName: "n1ago" },
  { id: "human", label: "Humano", icon: UserCircle, bgClass: "bg-amber-100", iconClass: "text-amber-600", handlerName: "zd-agentWorkspace" },
  { id: "bot", label: "Bot Zendesk", icon: Bot, bgClass: "bg-emerald-100", iconClass: "text-emerald-600", handlerName: "zd-answerBot" },
];

export function TransferConversationModal({ isOpen, onClose, conversationId, currentHandler }: TransferConversationModalProps) {
  const queryClient = useQueryClient();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);

  const transferMutation = useMutation({
    mutationFn: async (target: string) => {
      const response = await fetch(`/api/conversations/${conversationId}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ target, reason: "manual_transfer" }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to transfer");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user-conversations-messages"] });
      onClose();
      setSelectedTarget(null);
    },
  });

  const handleTransfer = () => {
    if (selectedTarget) {
      transferMutation.mutate(selectedTarget);
    }
  };

  if (!isOpen) return null;

  const currentHandlerNormalized = currentHandler?.toLowerCase() || "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
        >
          <X className="w-5 h-5" />
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Transferir conversa para...
        </h2>

        <div className="space-y-2 mb-6">
          {TRANSFER_TARGETS.map((target) => {
            const Icon = target.icon;
            const isCurrent = currentHandlerNormalized.includes(target.handlerName.toLowerCase());
            const isSelected = selectedTarget === target.id;

            return (
              <button
                key={target.id}
                onClick={() => !isCurrent && setSelectedTarget(target.id)}
                disabled={isCurrent}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                  isCurrent
                    ? "bg-gray-50 border-gray-200 opacity-50 cursor-not-allowed"
                    : isSelected
                    ? "border-purple-500 bg-purple-50"
                    : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
                }`}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${target.bgClass}`}>
                  <Icon className={`w-5 h-5 ${target.iconClass}`} />
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium text-gray-900">{target.label}</span>
                  {isCurrent && (
                    <span className="ml-2 text-xs text-gray-500">(atual)</span>
                  )}
                </div>
                {isSelected && (
                  <ArrowRight className="w-5 h-5 text-purple-600" />
                )}
              </button>
            );
          })}
        </div>

        {transferMutation.error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {transferMutation.error.message}
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleTransfer}
            disabled={!selectedTarget || transferMutation.isPending}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferindo...
              </>
            ) : (
              "Transferir"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
