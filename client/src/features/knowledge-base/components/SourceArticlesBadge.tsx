import { FileText, ExternalLink } from "lucide-react";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";

interface SourceArticlesBadgeProps {
  rawExtraction: KnowledgeSuggestion["rawExtraction"];
}

export function SourceArticlesBadge({ rawExtraction }: SourceArticlesBadgeProps) {
  if (!rawExtraction?.sourceArticles || rawExtraction.sourceArticles.length === 0) return null;
  
  const isEnrichment = rawExtraction.enrichmentSource === "zendesk";
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-medium text-blue-800">
          {isEnrichment ? "Fontes do Zendesk" : "Artigos Relacionados"} ({rawExtraction.sourceArticles.length})
        </span>
      </div>
      <div className="space-y-1">
        {rawExtraction.sourceArticles.map((article, i) => (
          <div key={article.id || i} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-blue-100">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-blue-600 font-mono shrink-0">#{article.id}</span>
              <span className="text-gray-700 truncate">{article.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                article.similarityScore >= 80 ? "bg-green-100 text-green-700" :
                article.similarityScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {article.similarityScore}%
              </span>
              {isEnrichment && (
                <a
                  href={`https://ifoodbr.zendesk.com/hc/pt-br/articles/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                  title="Abrir no Zendesk"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
