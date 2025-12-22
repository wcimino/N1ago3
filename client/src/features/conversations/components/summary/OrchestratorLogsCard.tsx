import { useState } from "react";
import { ChevronDown, ChevronRight, Activity } from "lucide-react";
import type { OrchestratorLogEntry } from "./types";
import { useDateFormatters } from "../../../../shared/hooks";

export interface OrchestratorLogsCardProps {
  logs: OrchestratorLogEntry[];
}

const agentLabels: Record<string, string> = {
  demand_finder: "DemandFinder",
  solution_provider: "SolutionProvider",
  closer: "Closer",
};

const actionLabels: Record<string, { label: string; color: string }> = {
  demand_confirmed: { label: "Demanda confirmada", color: "bg-green-100 text-green-700" },
  sent_clarification: { label: "Enviou clarificação", color: "bg-yellow-100 text-yellow-700" },
  escalated_max_interactions: { label: "Escalado (max interações)", color: "bg-red-100 text-red-700" },
  completed: { label: "Concluído", color: "bg-blue-100 text-blue-700" },
  failed: { label: "Falhou", color: "bg-red-100 text-red-700" },
};

function LogEntry({ entry, sequenceNumber, isExpanded, onToggle, formatDateTime }: { entry: OrchestratorLogEntry; sequenceNumber: number; isExpanded: boolean; onToggle: () => void; formatDateTime: (date: string | Date) => string }) {
  const agentLabel = agentLabels[entry.agent] || entry.agent;
  const actionConfig = actionLabels[entry.action] || { label: entry.action, color: "bg-gray-100 text-gray-700" };

  return (
    <div className="border border-gray-200 rounded-md overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-3 py-2 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />
        )}
        <span className="text-xs font-medium text-gray-600">#{sequenceNumber}</span>
        <span className="text-xs text-gray-400">{formatDateTime(entry.timestamp)}</span>
        <span className="text-xs font-medium text-indigo-600">{agentLabel}</span>
        <span className={`ml-auto px-2 py-0.5 rounded text-xs font-medium ${actionConfig.color}`}>
          {actionConfig.label}
        </span>
      </button>
      
      {isExpanded && (
        <div className="px-3 py-2 text-xs space-y-2 bg-white">
          <div className="flex items-start gap-2">
            <span className="text-gray-500 min-w-[100px]">Estado inicial:</span>
            <div className="flex flex-wrap gap-1">
              <span className="px-1.5 py-0.5 bg-gray-100 rounded">{entry.state.status}</span>
              <span className="px-1.5 py-0.5 bg-gray-100 rounded">owner: {entry.state.owner || "null"}</span>
              <span className="px-1.5 py-0.5 bg-gray-100 rounded">waiting: {entry.state.waitingForCustomer ? "sim" : "não"}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-500 min-w-[100px]">Results SC:</span>
            <span>{entry.solutionCenterResults}</span>
          </div>
          
          {entry.aiDecision && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[100px]">Decisão IA:</span>
              <span className="font-medium text-indigo-700">{entry.aiDecision}</span>
            </div>
          )}
          
          {entry.aiReason && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[100px]">Motivo:</span>
              <span className="text-gray-700 italic">{entry.aiReason}</span>
            </div>
          )}
          
          {entry.details && Object.keys(entry.details).length > 0 && (
            <div className="flex items-start gap-2">
              <span className="text-gray-500 min-w-[100px]">Detalhes:</span>
              <pre className="text-gray-600 bg-gray-50 rounded p-1 overflow-x-auto max-w-full">
                {JSON.stringify(entry.details, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function OrchestratorLogsCard({ logs }: OrchestratorLogsCardProps) {
  const [expandedIndexes, setExpandedIndexes] = useState<Set<number>>(new Set());
  const [isCardExpanded, setIsCardExpanded] = useState(false);
  const { formatDateTime } = useDateFormatters();

  if (!logs || logs.length === 0) {
    return null;
  }

  const toggleIndex = (index: number) => {
    setExpandedIndexes((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const sortedLogs = [...logs].sort((a, b) => b.turn - a.turn);

  return (
    <div className="rounded-lg p-3 bg-indigo-50 border border-indigo-200">
      <button
        onClick={() => setIsCardExpanded(!isCardExpanded)}
        className="w-full flex items-center gap-2"
      >
        {isCardExpanded ? (
          <ChevronDown className="w-4 h-4 text-indigo-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-indigo-600" />
        )}
        <div className="text-indigo-600">
          <Activity className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Logs do Orchestrator</h4>
        <span className="ml-auto text-xs text-indigo-600 font-medium">{logs.length} rodadas</span>
      </button>
      
      {isCardExpanded && (
        <div className="mt-3 space-y-2">
          {sortedLogs.map((entry, index) => (
            <LogEntry
              key={index}
              entry={entry}
              sequenceNumber={sortedLogs.length - index}
              isExpanded={expandedIndexes.has(index)}
              onToggle={() => toggleIndex(index)}
              formatDateTime={formatDateTime}
            />
          ))}
        </div>
      )}
    </div>
  );
}
