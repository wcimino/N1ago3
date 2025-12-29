import { Lightbulb, Check, Info } from "lucide-react";
import { useState } from "react";
import type { SolutionCenterResult } from "./types";

interface InfoTooltipProps {
  confidence?: number;
  reason?: string;
}

function InfoTooltip({ confidence, reason }: InfoTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  
  if (!confidence && !reason) return null;
  
  return (
    <div className="relative inline-block">
      <button
        type="button"
        className="flex items-center justify-center w-4 h-4 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
        onClick={(e) => {
          e.stopPropagation();
          setIsVisible(!isVisible);
        }}
      >
        <Info className="w-3 h-3" />
      </button>
      {isVisible && (
        <div className="absolute z-50 left-full ml-2 top-1/2 -translate-y-1/2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
          {confidence !== undefined && (
            <div className="mb-2">
              <span className="font-semibold text-green-300">Confiança:</span>{" "}
              <span>{confidence}%</span>
            </div>
          )}
          {reason && (
            <div>
              <span className="font-semibold text-green-300">Motivo:</span>{" "}
              <span className="text-gray-200">{reason}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export interface SolutionCenterCardProps {
  items?: SolutionCenterResult[] | null;
  selectedId?: string | null;
  selectedReason?: string | null;
  selectedConfidence?: number | null;
}

export function SolutionCenterCard({ items, selectedId, selectedReason, selectedConfidence }: SolutionCenterCardProps) {
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
          {itemsList.map((item) => {
            const isSelected = selectedId === item.id;
            return (
              <div 
                key={`${item.type}-${item.id}`} 
                className={`rounded px-3 py-2 ${
                  isSelected 
                    ? "bg-green-50 border-2 border-green-400 ring-1 ring-green-200" 
                    : "bg-white border border-violet-100"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <>
                        <span className="flex items-center justify-center w-5 h-5 rounded-full bg-green-500 text-white">
                          <Check className="w-3 h-3" />
                        </span>
                        <InfoTooltip confidence={selectedConfidence ?? item.confidence} reason={selectedReason || item.reason} />
                      </>
                    )}
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      item.type === "article" 
                        ? "bg-indigo-100 text-indigo-700" 
                        : "bg-fuchsia-100 text-fuchsia-700"
                    }`}>
                      {item.type === "article" ? "Artigo" : "Problema"}
                    </span>
                    <span className={`text-sm font-medium ${isSelected ? "text-green-800" : "text-gray-700"}`}>
                      {item.name}
                    </span>
                  </div>
                  {item.score !== undefined && (
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isSelected 
                        ? "text-green-700 bg-green-100" 
                        : "text-violet-600 bg-violet-100"
                    }`}>
                      {Math.round(item.score * 100)}%
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum resultado da Central de Soluções
        </div>
      )}
    </div>
  );
}
