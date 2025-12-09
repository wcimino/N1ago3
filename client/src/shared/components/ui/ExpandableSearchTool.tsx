import { ReactNode } from "react";
import { ChevronDown, ChevronUp, Search, FileText } from "lucide-react";
import { Button } from "./Button";

interface ExpandableSearchToolProps {
  title: string;
  description: string;
  icon: ReactNode;
  iconBgColor: string;
  accentColor: string;
  isExpanded: boolean;
  onToggle: () => void;
  isLoading?: boolean;
  onSearch: () => void;
  error?: Error | null;
  helpText?: string;
  children: ReactNode;
  results?: ReactNode;
  resultsCount?: number;
  resultsLabel?: string;
  emptyIcon?: ReactNode;
  emptyMessage?: string;
}

const colorVariants: Record<string, { button: string; focus: string }> = {
  indigo: {
    button: "bg-indigo-600 hover:bg-indigo-700",
    focus: "focus:ring-indigo-500",
  },
  orange: {
    button: "bg-orange-600 hover:bg-orange-700",
    focus: "focus:ring-orange-500",
  },
  green: {
    button: "bg-green-600 hover:bg-green-700",
    focus: "focus:ring-green-500",
  },
  purple: {
    button: "bg-purple-600 hover:bg-purple-700",
    focus: "focus:ring-purple-500",
  },
};

export function ExpandableSearchTool({
  title,
  description,
  icon,
  iconBgColor,
  accentColor,
  isExpanded,
  onToggle,
  isLoading = false,
  onSearch,
  error,
  helpText,
  children,
  results,
  resultsCount,
  resultsLabel = "itens",
  emptyIcon,
  emptyMessage = "Nenhum resultado encontrado",
}: ExpandableSearchToolProps) {
  const colors = colorVariants[accentColor] || colorVariants.purple;

  return (
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-100 transition-colors"
      >
        <div className={`w-10 h-10 sm:w-12 sm:h-12 ${iconBgColor} rounded-lg flex items-center justify-center shrink-0`}>
          {icon}
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-600">{description}</p>
        </div>
        <div className="shrink-0">
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </button>

      {isExpanded && (
        <div className="border-t bg-white p-4 sm:p-6 space-y-4">
          {helpText && (
            <p className="text-sm text-gray-600" dangerouslySetInnerHTML={{ __html: helpText }} />
          )}

          {children}

          <button
            onClick={onSearch}
            disabled={isLoading}
            className={`w-full px-4 py-2 ${colors.button} text-white rounded-md disabled:opacity-50 flex items-center justify-center gap-2 transition-colors`}
          >
            <Search className="w-4 h-4" />
            {isLoading ? "Buscando..." : "Buscar"}
          </button>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">Erro ao buscar: {error.message}</p>
            </div>
          )}

          {results !== undefined && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900">
                  Resultados ({resultsCount} {resultsCount === 1 ? resultsLabel.replace(/s$/, '') : resultsLabel})
                </h4>
              </div>

              {resultsCount === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  {emptyIcon || <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />}
                  <p className="text-sm">{emptyMessage}</p>
                </div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {results}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
