import { Clock, CheckCircle, XCircle, GitMerge, Plus, Pencil, AlertTriangle } from "lucide-react";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    merged: "bg-blue-100 text-blue-800",
    skipped: "bg-gray-100 text-gray-800",
  };
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
    merged: <GitMerge className="w-3 h-3" />,
    skipped: <CheckCircle className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    merged: "Mesclado",
    skipped: "Sem melhoria",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {icons[status]}
      {labels[status] || status}
    </span>
  );
}

export function ConfidenceBadge({ score }: { score: number | null }) {
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

export function SuggestionTypeBadge({ type, targetArticleId }: { type: string; targetArticleId: number | null }) {
  if (type === "update" && targetArticleId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <Pencil className="w-3 h-3" />
        Atualizar #{targetArticleId}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
      <Plus className="w-3 h-3" />
      Criar novo
    </span>
  );
}

export function QualityFlags({ flags }: { flags: KnowledgeSuggestion["qualityFlags"] }) {
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
