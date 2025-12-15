import { BookOpen } from "lucide-react";
import { MatchedTermsTooltip } from "./MatchedTermsTooltip";
import type { ArticleAndProblemResult } from "./types";

export interface ArticlesAndProblemsCardProps {
  items?: ArticleAndProblemResult[] | null;
}

export function ArticlesAndProblemsCard({ items }: ArticlesAndProblemsCardProps) {
  const itemsList = [...(items || [])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const hasItems = itemsList.length > 0;
  const articleCount = itemsList.filter(i => i.source === "article").length;
  const problemCount = itemsList.filter(i => i.source === "problem").length;
  
  return (
    <div className="rounded-lg p-3 bg-cyan-50 border border-cyan-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-cyan-600">
          <BookOpen className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Artigos e Problemas</h4>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-cyan-100 text-cyan-700">
          {articleCount} artigo{articleCount !== 1 ? "s" : ""} / {problemCount} problema{problemCount !== 1 ? "s" : ""}
        </span>
      </div>
      
      {hasItems ? (
        <div className="space-y-2">
          {itemsList.map((item) => (
            <div key={`${item.source}-${item.id}`} className="bg-white rounded px-3 py-2 border border-cyan-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.source === "article" 
                      ? "bg-blue-100 text-blue-700" 
                      : "bg-purple-100 text-purple-700"
                  }`}>
                    {item.source === "article" ? "Artigo" : "Problema"}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                </div>
                {item.matchScore !== undefined && (
                  <span className="flex items-center text-xs text-cyan-600 bg-cyan-100 px-2 py-0.5 rounded">
                    {item.matchScore}%
                    <MatchedTermsTooltip matchedTerms={item.matchedTerms} bgColor="bg-cyan-100" textColor="text-cyan-600" />
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum artigo ou problema encontrado
        </div>
      )}
    </div>
  );
}
