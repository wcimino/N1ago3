import { useState, useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, RefreshCw, Filter, ArrowLeft, Inbox, CheckCircle, AlertTriangle, XCircle, Play, ChevronDown, ChevronRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { fetchApi } from "../../../lib/queryClient";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { LoadingSpinner } from "../../../shared/components/ui/LoadingSpinner";

interface QuestionTopic {
  produto: string;
  subproduto: string | null;
  question: string;
  problema: string | null;
  count: number;
  topScore: number | null;
  theme?: string;
}

interface ThemeSummary {
  theme: string;
  count: number;
  avgScore: number | null;
  coverage: "good" | "medium" | "low" | "unknown";
  questions: Array<{
    question: string;
    count: number;
    subproduto: string | null;
    topScore: number | null;
  }>;
}

interface CoverageSummary {
  total: number;
  goodCoverage: number;
  mediumCoverage: number;
  lowCoverage: number;
  noCoverage: number;
}

interface QuestionTopicsResult {
  questions: QuestionTopic[];
  themes: ThemeSummary[];
  total: number;
  coverage: CoverageSummary;
}

type PeriodFilter = "last_hour" | "last_24h" | "all";
type CoverageFilter = "all" | "good" | "medium" | "low";

function getCoverageColor(score: number | null): string {
  if (score === null) return "bg-gray-100 text-gray-600";
  if (score >= 70) return "bg-green-100 text-green-700";
  if (score >= 50) return "bg-yellow-100 text-yellow-700";
  return "bg-red-100 text-red-700";
}

function getCoverageBarColor(coverage: string): string {
  if (coverage === "good") return "bg-green-500";
  if (coverage === "medium") return "bg-yellow-500";
  if (coverage === "low") return "bg-red-500";
  return "bg-gray-400";
}

function getCoverageLevel(score: number | null): "good" | "medium" | "low" | "unknown" {
  if (score === null) return "unknown";
  if (score >= 70) return "good";
  if (score >= 50) return "medium";
  return "low";
}

function getCoverageBadge(coverage: string): { bg: string; text: string; label: string } {
  switch (coverage) {
    case "good": return { bg: "bg-green-100", text: "text-green-700", label: "Boa" };
    case "medium": return { bg: "bg-yellow-100", text: "text-yellow-700", label: "Média" };
    case "low": return { bg: "bg-red-100", text: "text-red-700", label: "Baixa" };
    default: return { bg: "bg-gray-100", text: "text-gray-600", label: "N/A" };
  }
}

function ThemeCard({ theme, isExpanded, onToggle }: { 
  theme: ThemeSummary; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
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
              <span className="font-semibold text-gray-900 truncate">{theme.theme}</span>
              <span className={`text-xs px-2 py-0.5 rounded ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
              {theme.avgScore !== null && (
                <span className={`text-xs px-2 py-0.5 rounded ${getCoverageColor(theme.avgScore)}`}>
                  Score: {theme.avgScore}
                </span>
              )}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {theme.questions.length} pergunta{theme.questions.length !== 1 ? "s" : ""} | {theme.count.toLocaleString("pt-BR")} ocorrência{theme.count !== 1 ? "s" : ""}
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
                  <th className="text-left py-2 px-4 font-medium text-gray-600">Pergunta</th>
                  <th className="text-left py-2 px-4 font-medium text-gray-600">Subproduto</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">Qtd</th>
                  <th className="text-right py-2 px-4 font-medium text-gray-600">Score KB</th>
                </tr>
              </thead>
              <tbody>
                {theme.questions.map((q, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-white">
                    <td className="py-2 px-4">
                      <p className="text-gray-700 max-w-md">{q.question}</p>
                    </td>
                    <td className="py-2 px-4 text-gray-500">
                      {q.subproduto || "-"}
                    </td>
                    <td className="py-2 px-4 text-right font-medium text-gray-900">
                      {q.count.toLocaleString("pt-BR")}
                    </td>
                    <td className="py-2 px-4 text-right">
                      {q.topScore !== null ? (
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs ${getCoverageColor(q.topScore)}`}>
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

export function QuestionTopicsPage() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodFilter>("last_24h");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");
  const [shouldFetch, setShouldFetch] = useState(false);
  const [hasGeneratedOnce, setHasGeneratedOnce] = useState(false);
  const [filtersChanged, setFiltersChanged] = useState(false);
  const [expandedThemes, setExpandedThemes] = useState<Set<string>>(new Set());
  
  const lastFetchedFilters = useRef({ product: "", period: "last_24h" as PeriodFilter });

  const productsQuery = useQuery<string[]>({
    queryKey: ["question-topics-products"],
    queryFn: () => fetchApi<string[]>("/api/reports/question-topics/products"),
  });

  const topicsQuery = useQuery<QuestionTopicsResult>({
    queryKey: ["question-topics", selectedProduct, selectedPeriod],
    queryFn: () => {
      const params = new URLSearchParams();
      if (selectedProduct) params.set("product", selectedProduct);
      params.set("period", selectedPeriod);
      const url = `/api/reports/question-topics?${params.toString()}`;
      return fetchApi<QuestionTopicsResult>(url);
    },
    enabled: shouldFetch,
  });

  useEffect(() => {
    if (hasGeneratedOnce) {
      const changed = selectedProduct !== lastFetchedFilters.current.product || 
                      selectedPeriod !== lastFetchedFilters.current.period;
      setFiltersChanged(changed);
    }
  }, [selectedProduct, selectedPeriod, hasGeneratedOnce]);

  const handleGenerateReport = () => {
    setShouldFetch(true);
    setHasGeneratedOnce(true);
    setFiltersChanged(false);
    lastFetchedFilters.current = { product: selectedProduct, period: selectedPeriod };
    queryClient.invalidateQueries({ queryKey: ["question-topics", selectedProduct, selectedPeriod] });
  };

  const toggleTheme = (theme: string) => {
    setExpandedThemes(prev => {
      const next = new Set(prev);
      if (next.has(theme)) {
        next.delete(theme);
      } else {
        next.add(theme);
      }
      return next;
    });
  };

  const expandAll = () => {
    if (topicsQuery.data) {
      setExpandedThemes(new Set(topicsQuery.data.themes.map(t => t.theme)));
    }
  };

  const collapseAll = () => {
    setExpandedThemes(new Set());
  };

  const filteredThemes = topicsQuery.data?.themes.filter(t => {
    if (coverageFilter === "all") return true;
    if (coverageFilter === "low") {
      return t.coverage === "low" || t.coverage === "unknown";
    }
    return t.coverage === coverageFilter;
  }) || [];

  const coverage = topicsQuery.data?.coverage;
  const goodPct = coverage && coverage.total > 0 ? Math.round((coverage.goodCoverage / coverage.total) * 100) : 0;
  const mediumPct = coverage && coverage.total > 0 ? Math.round((coverage.mediumCoverage / coverage.total) * 100) : 0;
  const lowPct = coverage && coverage.total > 0 ? Math.round(((coverage.lowCoverage + coverage.noCoverage) / coverage.total) * 100) : 0;

  const periodLabels: Record<PeriodFilter, string> = {
    last_hour: "Última hora",
    last_24h: "Últimas 24 horas",
    all: "Todo o período",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Link href="/reports" className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </Link>
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Temas das Perguntas</h1>
            <p className="text-sm text-gray-500">Análise de temas e cobertura da base de conhecimento</p>
          </div>
        </div>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Filter className="w-5 h-5 text-gray-500" />
          Configurar Relatório
        </h3>
        <div className="flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Período</label>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" />
              <select
                value={selectedPeriod}
                onChange={(e) => {
                  setSelectedPeriod(e.target.value as PeriodFilter);
                  setShouldFetch(false);
                }}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="last_hour">Última hora</option>
                <option value="last_24h">Últimas 24 horas</option>
                <option value="all">Todo o período</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-gray-700">Produto (opcional)</label>
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setShouldFetch(false);
              }}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos os produtos</option>
              {productsQuery.data?.map((product) => (
                <option key={product} value={product}>
                  {product}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={handleGenerateReport}
            disabled={topicsQuery.isFetching}
            className="flex items-center gap-2"
          >
            {topicsQuery.isFetching ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Gerar Relatório
              </>
            )}
          </Button>
        </div>
        
        {filtersChanged && topicsQuery.data && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Os filtros foram alterados. Clique em "Gerar Relatório" para atualizar os resultados.</span>
          </div>
        )}
      </Card>

      {!shouldFetch && !topicsQuery.data && (
        <Card className="p-12 text-center">
          <BarChart3 className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Selecione o período e clique em "Gerar Relatório"</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Este relatório usa IA para classificar os temas das perguntas dos clientes.
            Escolha o período desejado e clique no botão para iniciar a análise.
          </p>
        </Card>
      )}

      {topicsQuery.isLoading && (
        <div className="flex flex-col items-center justify-center py-12">
          <LoadingSpinner />
          <span className="mt-3 text-gray-500">Classificando temas com IA...</span>
          <span className="text-sm text-gray-400 mt-1">Isso pode levar alguns segundos</span>
        </div>
      )}

      {topicsQuery.isError && (
        <Card className="p-6 text-center">
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">Erro ao carregar dados do relatório</p>
          <Button onClick={handleGenerateReport}>
            Tentar novamente
          </Button>
        </Card>
      )}

      {topicsQuery.data && topicsQuery.data.questions.length === 0 && !filtersChanged && (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma pergunta encontrada</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Não foram encontradas perguntas para {periodLabels[lastFetchedFilters.current.period].toLowerCase()}
            {lastFetchedFilters.current.product && ` no produto "${lastFetchedFilters.current.product}"`}.
            Tente ajustar os filtros ou selecione um período maior.
          </p>
        </Card>
      )}

      {topicsQuery.data && topicsQuery.data.questions.length > 0 && !filtersChanged && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Total de Chamados</div>
              <div className="text-2xl font-bold text-gray-900">
                {topicsQuery.data.total.toLocaleString("pt-BR")}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Perguntas Distintas</div>
              <div className="text-2xl font-bold text-gray-900">
                {topicsQuery.data.questions.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Temas Identificados</div>
              <div className="text-2xl font-bold text-gray-900">
                {topicsQuery.data.themes.length}
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-green-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <CheckCircle className="w-4 h-4 text-green-500" />
                Boa Cobertura
              </div>
              <div className="text-2xl font-bold text-green-600">
                {goodPct}%
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <XCircle className="w-4 h-4 text-red-500" />
                Gaps
              </div>
              <div className="text-2xl font-bold text-red-600">
                {lowPct}%
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h3 className="text-lg font-semibold">Detalhamento por Tema</h3>
              <div className="flex items-center gap-3">
                <select
                  value={coverageFilter}
                  onChange={(e) => setCoverageFilter(e.target.value as CoverageFilter)}
                  className="border border-gray-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="all">Todos os temas</option>
                  <option value="good">Boa cobertura</option>
                  <option value="medium">Cobertura média</option>
                  <option value="low">Gaps (baixa/sem cobertura)</option>
                </select>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={expandAll}>
                    Expandir todos
                  </Button>
                  <Button variant="outline" size="sm" onClick={collapseAll}>
                    Recolher todos
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {filteredThemes.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  Nenhum tema encontrado com o filtro selecionado
                </div>
              ) : (
                filteredThemes.map((theme) => (
                  <ThemeCard
                    key={theme.theme}
                    theme={theme}
                    isExpanded={expandedThemes.has(theme.theme)}
                    onToggle={() => toggleTheme(theme.theme)}
                  />
                ))
              )}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
