import { Loader2, Sparkles, AlertCircle, CheckCircle } from "lucide-react";
import { EmbeddingProgress } from "../types/zendesk";

interface EmbeddingProgressPanelProps {
  progress: EmbeddingProgress | undefined;
  showSuccessMessage?: boolean;
}

export function EmbeddingProgressPanel({ progress, showSuccessMessage = false }: EmbeddingProgressPanelProps) {
  if (!progress) return null;

  if (progress.isProcessing && progress.pending > 0) {
    return (
      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-blue-700 font-medium mb-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <Sparkles className="w-4 h-4" />
          Gerando embeddings...
        </div>
        <div className="w-full bg-blue-200 rounded-full h-2.5">
          <div 
            className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
            style={{ width: `${progress.progress}%` }}
          />
        </div>
        <div className="mt-2 text-blue-600 text-xs">
          {progress.completed} de {progress.total} artigos processados
          {progress.outdated > 0 && ` (${progress.outdated} desatualizados)`}
        </div>
      </div>
    );
  }

  if (!progress.isProcessing && progress.pending > 0) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-amber-700 font-medium">
          <AlertCircle className="w-4 h-4" />
          <Sparkles className="w-4 h-4" />
          {progress.pending} artigos aguardando embeddings
        </div>
        <div className="mt-1 text-amber-600 text-xs">
          Clique em "Sincronizar" para gerar os embeddings automaticamente
        </div>
      </div>
    );
  }

  if (progress.pending === 0 && progress.total > 0 && showSuccessMessage) {
    return (
      <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm">
        <div className="flex items-center gap-2 text-emerald-700 font-medium">
          <Sparkles className="w-4 h-4" />
          <CheckCircle className="w-4 h-4" />
          Todos os embeddings foram gerados
        </div>
        <div className="mt-1 text-emerald-600 text-xs">
          {progress.total} artigos com embeddings prontos para busca semântica
        </div>
      </div>
    );
  }

  return null;
}
