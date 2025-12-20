import { Lightbulb } from "lucide-react";
import type { SolutionCenterResult } from "./types";

export interface SolutionCenterCardProps {
  items?: SolutionCenterResult[] | null;
}

export function SolutionCenterCard({ items }: SolutionCenterCardProps) {
  const itemsList = [...(items || [])].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const hasItems = itemsList.length > 0;
  const articleCount = itemsList.filter(i => i.type === "article").length;
  const problemCount = itemsList.filter(i => i.type === "problem").length;
  
  return (
    <div className="rounded-lg p-3 bg-violet-50 border border-violet-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-violet-600">
          <Lightbulb className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Central de Soluções</h4>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
          {articleCount} artigo{articleCount !== 1 ? "s" : ""} / {problemCount} problema{problemCount !== 1 ? "s" : ""}
        </span>
      </div>
      
      {hasItems ? (
        <div className="space-y-2">
          {itemsList.map((item) => (
            <div key={`${item.type}-${item.id}`} className="bg-white rounded px-3 py-2 border border-violet-100">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                    item.type === "article" 
                      ? "bg-indigo-100 text-indigo-700" 
                      : "bg-fuchsia-100 text-fuchsia-700"
                  }`}>
                    {item.type === "article" ? "Artigo" : "Problema"}
                  </span>
                  <span className="text-sm text-gray-700 font-medium">{item.name}</span>
                </div>
                {item.score !== undefined && (
                  <span className="text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                    {Math.round(item.score * 100)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum resultado da Central de Soluções
        </div>
      )}
    </div>
  );
}
