import { ConfidenceTooltip } from "./ConfidenceTooltip";

export interface ProductRowProps {
  product?: string | null;
  subproduct?: string | null;
  confidence?: number | null;
  confidenceReason?: string | null;
}

export function ProductRow({ product, subproduct, confidence, confidenceReason }: ProductRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-sm text-gray-500">Produto:</span>
      <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-sm font-medium">
        {product || "(vazio)"} {">"} {subproduct || "(vazio)"}
      </span>
      <ConfidenceTooltip confidence={confidence} reason={confidenceReason} />
    </div>
  );
}
