import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

interface EnrichmentResponse {
  success: boolean;
  intentsProcessed: number;
  articlesCreated: number;
  articlesUpdated: number;
  suggestionsGenerated: number;
  skipped: number;
  message?: string;
  errors?: string[];
}

export function EnrichmentPanel() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedSubproduct, setSelectedSubproduct] = useState<string>("");
  const [limit, setLimit] = useState<number>(3);

  const { data: products = [] } = useQuery<string[]>({
    queryKey: ["product-catalog-distinct-produtos"],
    queryFn: () => fetchApi<string[]>("/api/product-catalog/distinct/produtos"),
  });

  const { data: subproducts = [] } = useQuery<string[]>({
    queryKey: ["product-catalog-distinct-subprodutos", selectedProduct],
    queryFn: () => fetchApi<string[]>(`/api/product-catalog/distinct/subprodutos?produto=${encodeURIComponent(selectedProduct)}`),
    enabled: !!selectedProduct,
  });

  const generateMutation = useMutation({
    mutationFn: async (params: { product?: string; subproduct?: string; limit: number }): Promise<EnrichmentResponse> => {
      const response = await apiRequest("POST", "/api/ai/enrichment/generate", params);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      product: selectedProduct || undefined,
      subproduct: selectedSubproduct || undefined,
      limit,
    });
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="flex-1 space-y-1">
          <h3 className="font-medium text-purple-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Gerar Sugestões de Melhoria
          </h3>
          <p className="text-sm text-purple-700">
            Analise artigos do Zendesk e gere sugestões de melhoria para a base de conhecimento
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative">
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedSubproduct("");
              }}
              className="appearance-none bg-white border border-purple-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[160px]"
            >
              <option value="">Todos os produtos</option>
              {products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
          </div>
          
          {selectedProduct && (
            <div className="relative">
              <select
                value={selectedSubproduct}
                onChange={(e) => setSelectedSubproduct(e.target.value)}
                className="appearance-none bg-white border border-purple-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[160px]"
              >
                <option value="">Todos subprodutos</option>
                {subproducts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-purple-700 whitespace-nowrap">Qtd. intenções:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-16 bg-white border border-purple-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar sugestões
              </>
            )}
          </button>
        </div>
      </div>
      
      {generateMutation.isError && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          Erro ao gerar sugestões. Verifique se a configuração de enriquecimento está ativada nas configurações de IA.
        </div>
      )}
      
      {generateMutation.isSuccess && generateMutation.data && (
        <>
          {(generateMutation.data.articlesCreated > 0 || generateMutation.data.articlesUpdated > 0) ? (
            <div className="mt-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-2">
              {generateMutation.data.articlesCreated > 0 && (
                <span>{generateMutation.data.articlesCreated} artigo(s) criado(s). </span>
              )}
              {generateMutation.data.articlesUpdated > 0 && (
                <span>{generateMutation.data.articlesUpdated} artigo(s) atualizado(s). </span>
              )}
              {generateMutation.data.skipped > 0 && (
                <span>{generateMutation.data.skipped} ignorado(s). </span>
              )}
              As novas sugestões aparecem na lista abaixo.
            </div>
          ) : generateMutation.data.intentsProcessed === 0 ? (
            <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
              {generateMutation.data.message || "Nenhuma intenção encontrada. Cadastre intenções primeiro na aba 'Assuntos e Intenções'."}
            </div>
          ) : generateMutation.data.skipped > 0 ? (
            <div className="mt-3 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-2">
              {generateMutation.data.skipped} intenção(ões) analisada(s), mas nenhuma sugestão gerada. 
              Os artigos já estão completos ou não há informação suficiente no Zendesk.
            </div>
          ) : (
            <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
              {generateMutation.data.message || "Nenhuma sugestão gerada."}
            </div>
          )}
          
          {generateMutation.data.errors && generateMutation.data.errors.length > 0 && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              Erros: {generateMutation.data.errors.join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}
