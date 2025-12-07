import { useState } from "react";
import { useKnowledgeSuggestions, type KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";
import { Check, X, GitMerge, AlertTriangle, Clock, CheckCircle, XCircle } from "lucide-react";

type StatusFilter = "pending" | "approved" | "rejected" | "merged" | "all";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    merged: "bg-blue-100 text-blue-800",
  };
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
    merged: <GitMerge className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    merged: "Mesclado",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {icons[status]}
      {labels[status] || status}
    </span>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  
  let color = "bg-red-100 text-red-800";
  if (score >= 80) color = "bg-green-100 text-green-800";
  else if (score >= 60) color = "bg-yellow-100 text-yellow-800";
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {score}%
    </span>
  );
}

function QualityFlags({ flags }: { flags: KnowledgeSuggestion["qualityFlags"] }) {
  if (!flags) return null;
  
  const warnings = [];
  if (flags.isUncertain) warnings.push("Incerto");
  if (flags.possibleError) warnings.push("Possível erro");
  if (!flags.isComplete) warnings.push("Incompleto");
  if (flags.needsReview) warnings.push("Precisa revisão");
  
  if (warnings.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-amber-600">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-xs">{warnings.join(", ")}</span>
    </div>
  );
}

function SuggestionCard({ 
  suggestion, 
  onApprove, 
  onReject,
  isApproving,
  isRejecting,
}: { 
  suggestion: KnowledgeSuggestion;
  onApprove: (id: number) => void;
  onReject: (params: { id: number; reason?: string }) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const handleReject = () => {
    if (showRejectReason) {
      onReject({ id: suggestion.id, reason: rejectReason });
      setShowRejectReason(false);
      setRejectReason("");
    } else {
      setShowRejectReason(true);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={suggestion.status} />
          <ConfidenceBadge score={suggestion.confidenceScore} />
          {suggestion.similarArticleId && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
              <GitMerge className="w-3 h-3" />
              Similar ({suggestion.similarityScore}%)
            </span>
          )}
        </div>
        <span className="text-xs text-gray-500">
          {new Date(suggestion.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>

      <QualityFlags flags={suggestion.qualityFlags} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {suggestion.productStandard && (
          <div>
            <span className="text-gray-500">Produto:</span>
            <p className="font-medium">{suggestion.productStandard}</p>
          </div>
        )}
        {suggestion.subproductStandard && (
          <div>
            <span className="text-gray-500">Subproduto:</span>
            <p className="font-medium">{suggestion.subproductStandard}</p>
          </div>
        )}
        {suggestion.category1 && (
          <div>
            <span className="text-gray-500">Categoria 1:</span>
            <p className="font-medium">{suggestion.category1}</p>
          </div>
        )}
        {suggestion.category2 && (
          <div>
            <span className="text-gray-500">Categoria 2:</span>
            <p className="font-medium">{suggestion.category2}</p>
          </div>
        )}
      </div>

      {suggestion.description && (
        <div>
          <span className="text-xs text-gray-500">Situação:</span>
          <p className="text-sm mt-1">{suggestion.description}</p>
        </div>
      )}

      {suggestion.resolution && (
        <div>
          <span className="text-xs text-gray-500">Solução:</span>
          <p className="text-sm mt-1 bg-green-50 p-2 rounded">{suggestion.resolution}</p>
        </div>
      )}

      {suggestion.observations && (
        <div>
          <span className="text-xs text-gray-500">Observações:</span>
          <p className="text-sm mt-1 text-gray-600">{suggestion.observations}</p>
        </div>
      )}

      {suggestion.status === "pending" && (
        <div className="pt-2 border-t">
          {showRejectReason ? (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Confirmar Rejeição
                </button>
                <button
                  onClick={() => setShowRejectReason(false)}
                  className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(suggestion.id)}
                disabled={isApproving}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Aprovar
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}

      {suggestion.status === "rejected" && suggestion.rejectionReason && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Motivo da rejeição:</span>
          <p className="text-sm text-red-600 mt-1">{suggestion.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

export function SuggestionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const { 
    suggestions, 
    stats, 
    isLoading, 
    approve, 
    reject, 
    isApproving, 
    isRejecting 
  } = useKnowledgeSuggestions(statusFilter === "all" ? undefined : statusFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "merged", "all"] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === status
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status === "pending" && `Pendentes${stats ? ` (${stats.pending})` : ""}`}
            {status === "approved" && `Aprovados${stats ? ` (${stats.approved})` : ""}`}
            {status === "rejected" && `Rejeitados${stats ? ` (${stats.rejected})` : ""}`}
            {status === "merged" && `Mesclados${stats ? ` (${stats.merged})` : ""}`}
            {status === "all" && "Todos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando sugestões...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhuma sugestão {statusFilter !== "all" ? `com status "${statusFilter}"` : "encontrada"}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApprove={approve}
              onReject={reject}
              isApproving={isApproving}
              isRejecting={isRejecting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
