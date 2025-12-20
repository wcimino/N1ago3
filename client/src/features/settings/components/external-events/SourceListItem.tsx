import { useState } from "react";
import { Trash2, Copy, RefreshCw, ToggleLeft, ToggleRight, Pencil, AlertTriangle } from "lucide-react";
import { useDateFormatters, useConfirmation } from "../../../../shared/hooks";
import { ConfirmModal } from "../../../../shared/components";
import type { ExternalEventSource } from "./types";

interface SourceListItemProps {
  source: ExternalEventSource;
  displayApiKey: string;
  hasNewKey: boolean;
  newKey?: string;
  needsRotation: boolean;
  daysSinceRotation: number;
  onEdit: () => void;
  onToggle: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  isTogglePending: boolean;
  isRegeneratePending: boolean;
  isDeletePending: boolean;
}

export function SourceListItem({
  source,
  displayApiKey,
  hasNewKey,
  newKey,
  needsRotation,
  daysSinceRotation,
  onEdit,
  onToggle,
  onRegenerate,
  onDelete,
  isTogglePending,
  isRegeneratePending,
  isDeletePending,
}: SourceListItemProps) {
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const { formatShortDateTime } = useDateFormatters();
  const confirmation = useConfirmation();

  const copyToClipboard = async (text: string, id: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <>
      <div
        className={`bg-white border rounded-lg p-4 ${
          source.is_active ? "border-gray-200" : "border-gray-300 bg-gray-50 opacity-75"
        }`}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className="font-medium text-gray-900">{source.name}</h4>
              {!source.is_active && (
                <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded">
                  Desativado
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mb-2 flex flex-wrap gap-2">
              <span className="font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                source: {source.source}
              </span>
              <span className="font-mono bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded">
                channel: {source.channel_type}
              </span>
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-gray-500">API Key:</span>
              <code className={`text-sm font-mono px-2 py-1 rounded ${hasNewKey ? "bg-green-100 text-green-800" : "bg-gray-100"}`}>
                {displayApiKey}
              </code>
              {hasNewKey && newKey && (
                <>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(newKey, source.id)}
                    className="text-gray-400 hover:text-gray-600"
                    title="Copiar"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                  {copiedId === source.id && (
                    <span className="text-xs text-green-600">Copiado!</span>
                  )}
                  <span className="text-xs text-amber-600">
                    Copie agora! Esta chave não será exibida novamente.
                  </span>
                </>
              )}
            </div>
            <p className="text-xs text-gray-400">
              Criado em {formatShortDateTime(source.created_at)}
              {source.created_by && ` por ${source.created_by}`}
            </p>
            {needsRotation && (
              <div className="flex items-center gap-1.5 mt-2 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>
                  Chave sem rotação há {daysSinceRotation} dias. Recomendamos regenerar.
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 ml-4">
            <button
              type="button"
              onClick={onEdit}
              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              title="Editar"
            >
              <Pencil className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={onToggle}
              disabled={isTogglePending}
              className={`p-1.5 rounded transition-colors ${
                source.is_active
                  ? "text-green-600 hover:bg-green-50"
                  : "text-gray-400 hover:bg-gray-100"
              }`}
              title={source.is_active ? "Desativar" : "Ativar"}
            >
              {source.is_active ? (
                <ToggleRight className="w-6 h-6" />
              ) : (
                <ToggleLeft className="w-6 h-6" />
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                confirmation.confirm({
                  title: "Regenerar chave de API",
                  message: "Regenerar a chave de API? A chave antiga deixará de funcionar.",
                  confirmLabel: "Regenerar",
                  variant: "warning",
                  onConfirm: onRegenerate,
                });
              }}
              disabled={isRegeneratePending}
              className="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
              title="Regenerar chave"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => {
                confirmation.confirm({
                  title: "Excluir sistema",
                  message: `Excluir o sistema "${source.name}"? Esta ação não pode ser desfeita.`,
                  confirmLabel: "Excluir",
                  variant: "danger",
                  onConfirm: onDelete,
                });
              }}
              disabled={isDeletePending}
              className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Excluir"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
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
    </>
  );
}
