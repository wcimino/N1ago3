import { ConfidenceTooltip } from "./ConfidenceTooltip";

export interface RequestTypeRowProps {
  requestType?: string | null;
  confidence?: number | null;
  confidenceReason?: string | null;
}

export function RequestTypeRow({ requestType, confidence, confidenceReason }: RequestTypeRowProps) {
  const getRequestTypeColor = (type: string | null | undefined) => {
    if (!type) return 'bg-gray-100 text-gray-500';
    const lower = type.toLowerCase();
    if (lower.includes('suporte')) return 'bg-orange-100 text-orange-700';
    if (lower.includes('contratar')) return 'bg-green-100 text-green-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500 min-w-[110px]">Tipo de conversa:</span>
      <span className={`px-2 py-0.5 rounded text-sm font-medium ${getRequestTypeColor(requestType)}`}>
        {requestType || "(vazio)"}
      </span>
      <ConfidenceTooltip confidence={confidence} reason={confidenceReason} />
    </div>
  );
}
