import { useQuery } from "@tanstack/react-query";
import { BarChart3, RefreshCw, AlertCircle } from "lucide-react";

interface ProductProblemCount {
  product: string;
  subproduct: string | null;
  problem: string;
  count: number;
}

export function ReportsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useQuery<ProductProblemCount[]>({
    queryKey: ["reports", "product-problem-counts"],
    queryFn: async () => {
      const response = await fetch("/api/reports/product-problem-counts");
      if (!response.ok) throw new Error("Falha ao carregar relatório");
      return response.json();
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-8 h-8 text-blue-600" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
            <p className="text-sm text-gray-500">Análise de atendimentos por produto e problema</p>
          </div>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-6 py-4 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Contagem por Produto e Problema</h2>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center py-12 text-red-600">
            <AlertCircle className="w-8 h-8 mb-2" />
            <p className="font-medium">Erro ao carregar relatório</p>
            <p className="text-sm text-gray-500 mt-1">{error instanceof Error ? error.message : "Tente novamente"}</p>
            <button
              onClick={() => refetch()}
              className="mt-4 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              Tentar novamente
            </button>
          </div>
        ) : !data || data.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            Nenhum dado encontrado
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Produto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Subproduto
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Problema
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Quantidade
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {row.product || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.subproduct || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {row.problem || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                      {row.count.toLocaleString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
