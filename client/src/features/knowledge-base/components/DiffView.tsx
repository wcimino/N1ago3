import { diffWordsWithSpace } from "diff";

export type DiffPart = {
  type: 'equal' | 'removed' | 'added';
  value: string;
};

export type DiffToken = {
  type: 'equal' | 'removed' | 'added';
  value: string;
};

export function computeTextDiff(oldText: string, newText: string): DiffToken[] {
  const rawDiff = diffWordsWithSpace(oldText, newText);
  
  const tokens: DiffToken[] = [];
  let pendingRemoved: string[] = [];
  let pendingAdded: string[] = [];
  
  const flushPending = () => {
    if (pendingRemoved.length > 0) {
      tokens.push({ type: 'removed', value: pendingRemoved.join('') });
      pendingRemoved = [];
    }
    if (pendingAdded.length > 0) {
      tokens.push({ type: 'added', value: pendingAdded.join('') });
      pendingAdded = [];
    }
  };
  
  for (const part of rawDiff) {
    if (part.added) {
      pendingAdded.push(part.value);
    } else if (part.removed) {
      pendingRemoved.push(part.value);
    } else {
      flushPending();
      tokens.push({ type: 'equal', value: part.value });
    }
  }
  flushPending();
  
  return tokens;
}

interface DiffPreviewProps { 
  label: string;
  before: string | null;
  after: string | null;
}

export function DiffPreview({ label, before, after }: DiffPreviewProps) {
  if (!before && !after) return null;
  
  const hasChange = before !== after;
  
  if (!hasChange) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-700">{label}:</span>
        <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200 text-gray-700">
          {before || <span className="text-gray-400 italic">Sem conteúdo</span>}
        </div>
      </div>
    );
  }
  
  const diffTokens = computeTextDiff(before || "", after || "");
  
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-700">{label}:</span>
      <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200 text-gray-700 leading-relaxed">
        {diffTokens.map((token, idx) => {
          if (token.type === 'removed') {
            return (
              <span key={idx} className="bg-red-100 text-red-800 line-through">
                {token.value}
              </span>
            );
          }
          if (token.type === 'added') {
            return (
              <span key={idx} className="bg-green-100 text-green-800">
                {token.value}
              </span>
            );
          }
          return <span key={idx}>{token.value}</span>;
        })}
      </div>
    </div>
  );
}
