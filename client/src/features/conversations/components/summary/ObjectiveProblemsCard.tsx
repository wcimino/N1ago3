import { AlertTriangle } from "lucide-react";
import { MatchedTermsTooltip } from "./MatchedTermsTooltip";
import type { ObjectiveProblemIdentified } from "./types";

export interface ObjectiveProblemsCardProps {
  problems?: ObjectiveProblemIdentified[] | null;
}

export function ObjectiveProblemsCard({ problems }: ObjectiveProblemsCardProps) {
  const problemsList = [...(problems || [])].sort((a, b) => (b.matchScore ?? 0) - (a.matchScore ?? 0));
  const hasProblems = problemsList.length > 0;
  
  return (
    <div className="rounded-lg p-3 bg-violet-50 border border-violet-200">
      <div className="flex items-center gap-2 mb-3">
        <div className="text-violet-600">
          <AlertTriangle className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Problemas</h4>
        <span className="ml-auto px-2 py-0.5 rounded text-xs font-medium bg-violet-100 text-violet-700">
          {problemsList.length} identificado{problemsList.length !== 1 ? "s" : ""}
        </span>
      </div>
      
      {hasProblems ? (
        <div className="space-y-2">
          {problemsList.map((problem) => (
            <div key={problem.id} className="flex items-center justify-between bg-white rounded px-3 py-2 border border-violet-100">
              <span className="text-sm text-gray-700 font-medium">{problem.name}</span>
              {problem.matchScore !== undefined && (
                <span className="flex items-center text-xs text-violet-600 bg-violet-100 px-2 py-0.5 rounded">
                  {problem.matchScore}%
                  <MatchedTermsTooltip matchedTerms={problem.matchedTerms} bgColor="bg-violet-100" textColor="text-violet-600" />
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-500 italic">
          Nenhum problema identificado
        </div>
      )}
    </div>
  );
}
