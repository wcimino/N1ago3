import { History } from "lucide-react";
import { LoadingState } from "../ui/LoadingSpinner";

interface HistoryItem {
  fieldName: string;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  source: string | null;
}

interface HistoryListProps {
  history: HistoryItem[] | undefined;
  isLoading: boolean;
  fieldLabels?: Record<string, string>;
  formatDateTime: (date: string) => string;
}

export function HistoryList({
  history,
  isLoading,
  fieldLabels = {},
  formatDateTime,
}: HistoryListProps) {
  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <History className="w-5 h-5 text-gray-500" />
        <h3 className="text-lg font-semibold text-gray-900">Histórico de Alterações</h3>
      </div>

      {isLoading ? (
        <LoadingState />
      ) : !history || history.length === 0 ? (
        <div className="p-6 text-center text-gray-500">
          <p>Nenhuma alteração registrada</p>
        </div>
      ) : (
        <div className="divide-y divide-gray-200">
          {history.map((item, index) => (
            <div key={index} className="p-4 hover:bg-gray-50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {fieldLabels[item.fieldName] || item.fieldName}
                  </p>
                  <div className="mt-1 text-sm">
                    <span className="text-red-600 line-through">
                      {item.oldValue || "(vazio)"}
                    </span>
                    <span className="mx-2 text-gray-400">→</span>
                    <span className="text-green-600">{item.newValue || "(vazio)"}</span>
                  </div>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <p>{formatDateTime(item.changedAt)}</p>
                  {item.source && <p className="text-xs">{item.source}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
