import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw, Filter, ArrowLeft, Inbox, CheckCircle, AlertTriangle, XCircle } from "lucide-react";
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

export function QuestionTopicsPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [coverageFilter, setCoverageFilter] = useState<CoverageFilter>("all");

  const productsQuery = useQuery<string[]>({
    queryKey: ["question-topics-products"],
    queryFn: () => fetchApi<string[]>("/api/reports/question-topics/products"),
  });

  const topicsQuery = useQuery<QuestionTopicsResult>({
    queryKey: ["question-topics", selectedProduct],
    queryFn: () => {
      const url = selectedProduct 
        ? `/api/reports/question-topics?product=${encodeURIComponent(selectedProduct)}`
        : "/api/reports/question-topics";
      return fetchApi<QuestionTopicsResult>(url);
    },
  });

  const handleRefresh = () => {
    topicsQuery.refetch();
  };

  const filteredQuestions = topicsQuery.data?.questions.filter(q => {
    if (coverageFilter === "all") return true;
    const level = getCoverageLevel(q.topScore);
    if (coverageFilter === "low") {
      return level === "low" || level === "unknown";
    }
    return level === coverageFilter;
  }) || [];

  const coverage = topicsQuery.data?.coverage;
  const goodPct = coverage && coverage.total > 0 ? Math.round((coverage.goodCoverage / coverage.total) * 100) : 0;
  const mediumPct = coverage && coverage.total > 0 ? Math.round((coverage.mediumCoverage / coverage.total) * 100) : 0;
  const lowPct = coverage && coverage.total > 0 ? Math.round(((coverage.lowCoverage + coverage.noCoverage) / coverage.total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <select
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
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
          <select
            value={coverageFilter}
            onChange={(e) => setCoverageFilter(e.target.value as CoverageFilter)}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Todas coberturas</option>
            <option value="good">Boa cobertura (≥70)</option>
            <option value="medium">Cobertura média (50-69)</option>
            <option value="low">Gaps (baixa cobertura)</option>
          </select>
          <Button
            onClick={handleRefresh}
            variant="outline"
            size="sm"
            disabled={topicsQuery.isFetching}
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${topicsQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {topicsQuery.isLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingSpinner />
          <span className="ml-3 text-gray-500">Classificando temas com IA...</span>
        </div>
      )}

      {topicsQuery.isError && (
        <Card className="p-6 text-center">
          <p className="text-red-600">Erro ao carregar dados do relatório</p>
          <Button onClick={handleRefresh} className="mt-4">
            Tentar novamente
          </Button>
        </Card>
      )}

      {topicsQuery.data && topicsQuery.data.questions.length === 0 && (
        <Card className="p-12 text-center">
          <Inbox className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Nenhuma pergunta encontrada</h3>
          <p className="text-gray-500 max-w-md mx-auto">
            Não foram encontradas perguntas para o período selecionado
            {selectedProduct && ` no produto "${selectedProduct}"`}.
            Tente ajustar os filtros ou aguarde novas conversas.
          </p>
        </Card>
      )}

      {topicsQuery.data && topicsQuery.data.questions.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card className="p-4">
              <div className="text-sm text-gray-500">Total de Chamados</div>
              <div className="text-2xl font-bold text-gray-900">
                {topicsQuery.data.total.toLocaleString("pt-BR")}
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
            <Card className="p-4 border-l-4 border-l-yellow-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <AlertTriangle className="w-4 h-4 text-yellow-500" />
                Cobertura Média
              </div>
              <div className="text-2xl font-bold text-yellow-600">
                {mediumPct}%
              </div>
            </Card>
            <Card className="p-4 border-l-4 border-l-red-500">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <XCircle className="w-4 h-4 text-red-500" />
                Gaps (Ação Necessária)
              </div>
              <div className="text-2xl font-bold text-red-600">
                {lowPct}%
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Distribuição por Tema</h3>
              <div className="space-y-3">
                {topicsQuery.data.themes.slice(0, 10).map((theme) => {
                  const percentage = Math.round((theme.count / topicsQuery.data.total) * 100);
                  return (
                    <div key={theme.theme}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700 flex items-center gap-2">
                          {theme.theme}
                          {theme.avgScore !== null && (
                            <span className={`text-xs px-1.5 py-0.5 rounded ${getCoverageColor(theme.avgScore)}`}>
                              {theme.avgScore}
                            </span>
                          )}
                        </span>
                        <span className="text-gray-500">
                          {theme.count.toLocaleString("pt-BR")} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${getCoverageBarColor(theme.coverage)}`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            <Card className="p-6">
              <h3 className="text-lg font-semibold mb-4">Top 10 Perguntas</h3>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {topicsQuery.data.questions.slice(0, 10).map((q, index) => (
                  <div key={index} className="border-b border-gray-100 pb-2">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-700 line-clamp-2">{q.question}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          {q.produto && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {q.produto}
                            </span>
                          )}
                          {q.theme && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                              {q.theme}
                            </span>
                          )}
                          {q.topScore !== null && (
                            <span className={`text-xs px-2 py-0.5 rounded ${getCoverageColor(q.topScore)}`}>
                              KB: {q.topScore}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 ml-2">
                        {q.count.toLocaleString("pt-BR")}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Detalhamento por Tema</h3>
              <span className="text-sm text-gray-500">
                Mostrando {filteredQuestions.length} de {topicsQuery.data.questions.length} perguntas
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Tema</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Produto</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Pergunta</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Problema</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Qtd</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Score KB</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestions.map((q, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {q.theme || "Outros"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div>{q.produto}</div>
                        {q.subproduto && (
                          <div className="text-xs text-gray-400">{q.subproduto}</div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-gray-700 max-w-xs truncate" title={q.question}>
                        {q.question}
                      </td>
                      <td className="py-3 px-4 text-gray-500 max-w-xs truncate" title={q.problema || "-"}>
                        {q.problema || "-"}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {q.count.toLocaleString("pt-BR")}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {q.topScore !== null ? (
                          <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${getCoverageColor(q.topScore)}`}>
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
          </Card>
        </>
      )}
    </div>
  );
}
