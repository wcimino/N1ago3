import { ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "../../../shared/components/ui/Card";
import { getCoverageBadge, getCoverageColor } from "../../../lib/coverageUtils";
import type { ThemeSummary } from "../../../types";

interface ThemeCardProps {
  theme: ThemeSummary;
  isExpanded: boolean;
  onToggle: () => void;
}

export function ThemeCard({ theme, isExpanded, onToggle }: ThemeCardProps) {
  const badge = getCoverageBadge(theme.coverage);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {isExpanded ? (
            <ChevronDown className="w-5 h-5 text-gray-400 flex-shrink-0" />
          ) : (
            <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-gray-900 truncate">
                {theme.theme}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}
              >
                {badge.label}
              </span>
              {theme.avgScore !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded ${getCoverageColor(theme.avgScore)}`}
                >
                  Score: {theme.avgScore}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {theme.questions.length} pergunta
              {theme.questions.length !== 1 ? "s" : ""} |{" "}
              {theme.count.toLocaleString("pt-BR")} ocorrência
              {theme.count !== 1 ? "s" : ""}
            </div>
          </div>
        </div>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gray-50">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-100">
                  <th className="text-left py-2 px-4 font-medium text-gray-600">
                    Pergunta
                  </th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">
                    Qtd
                  </th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">
                    Score KB
                  </th>
                </tr>
              </thead>
              <tbody>
                {theme.questions.map((q, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 hover:bg-white"
                  >
                    <td className="py-2 px-4">
                      <p className="text-gray-700 max-w-md">{q.question}</p>
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900">
                      {q.count.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {q.topScore !== null ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-xs ${getCoverageColor(q.topScore)}`}
                        >
                          {q.topScore}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}
