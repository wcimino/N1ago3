import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw, Filter } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import { Card } from "../../../shared/components/ui/Card";
import { Button } from "../../../shared/components/ui/Button";
import { LoadingSpinner } from "../../../shared/components/ui/LoadingSpinner";

interface QuestionTopic {
  produto: string;
  subproduto: string | null;
  question: string;
  count: number;
  theme?: string;
}

interface ThemeSummary {
  theme: string;
  count: number;
  questions: Array<{
    question: string;
    count: number;
    subproduto: string | null;
  }>;
}

interface QuestionTopicsResult {
  questions: QuestionTopic[];
  themes: ThemeSummary[];
  total: number;
}

export function QuestionTopicsPage() {
  const [selectedProduct, setSelectedProduct] = useState<string>("");

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Temas das Perguntas</h1>
            <p className="text-sm text-gray-500">Análise de temas mais frequentes por produto</p>
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

      {topicsQuery.data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
            <Card className="p-4">
              <div className="text-sm text-gray-500">Perguntas Únicas</div>
              <div className="text-2xl font-bold text-gray-900">
                {topicsQuery.data.questions.length}
              </div>
            </Card>
            <Card className="p-4">
              <div className="text-sm text-gray-500">Produto Filtrado</div>
              <div className="text-2xl font-bold text-gray-900">
                {selectedProduct || "Todos"}
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
                        <span className="font-medium text-gray-700">{theme.theme}</span>
                        <span className="text-gray-500">
                          {theme.count.toLocaleString("pt-BR")} ({percentage}%)
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full transition-all"
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
                        <div className="flex items-center gap-2 mt-1">
                          {q.subproduto && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                              {q.subproduto}
                            </span>
                          )}
                          {q.theme && (
                            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded">
                              {q.theme}
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
            <h3 className="text-lg font-semibold mb-4">Detalhamento por Tema</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Tema</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Subproduto</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-600">Pergunta</th>
                    <th className="text-right py-3 px-4 font-semibold text-gray-600">Contagem</th>
                  </tr>
                </thead>
                <tbody>
                  {topicsQuery.data.questions.map((q, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          {q.theme || "Outros"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-gray-600">{q.subproduto || "-"}</td>
                      <td className="py-3 px-4 text-gray-700 max-w-md truncate" title={q.question}>
                        {q.question}
                      </td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">
                        {q.count.toLocaleString("pt-BR")}
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
