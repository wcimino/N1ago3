import { useState } from "react";
import { useKnowledgeSuggestions } from "../hooks/useKnowledgeSuggestions";
import { SuggestionCard } from "../components/SuggestionCard";

type StatusFilter = "pending" | "approved" | "rejected" | "merged" | "all";

export function SuggestionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const { 
    suggestions, 
    stats, 
    isLoading, 
    approve, 
    reject, 
    isApproving, 
    isRejecting,
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
