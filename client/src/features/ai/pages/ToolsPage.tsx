import { useState } from "react";
import { Search, FileText, Tag, Package } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type SearchType = "combined" | "product" | "category" | "keywords";

interface SearchResult {
  id: number;
  productStandard: string | null;
  subproductStandard: string | null;
  intent: string | null;
  description: string | null;
  resolution: string | null;
  score?: number;
}

interface SearchResponse {
  results: SearchResult[];
  total: number;
}

export function ToolsPage() {
  const [searchType, setSearchType] = useState<SearchType>("combined");
  const [product, setProduct] = useState("");
  const [intent, setIntent] = useState("");
  const [keywords, setKeywords] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const buildSearchParams = () => {
    const params = new URLSearchParams();
    params.set("limit", "10");

    switch (searchType) {
      case "combined":
        if (product) params.set("product", product);
        if (intent) params.set("intent", intent);
        if (keywords) params.set("keywords", keywords);
        return { endpoint: "/api/knowledge-base-search", params };
      case "product":
        params.set("q", product);
        return { endpoint: "/api/knowledge-base-search/product", params };
      case "category":
        params.set("category1", intent);
        return { endpoint: "/api/knowledge-base-search/category", params };
      case "keywords":
        params.set("q", keywords);
        return { endpoint: "/api/knowledge-base-search/keywords", params };
      default:
        return { endpoint: "/api/knowledge-base-search", params };
    }
  };

  const { endpoint, params } = buildSearchParams();

  const { data, isLoading, error, refetch } = useQuery<SearchResponse>({
    queryKey: ["knowledge-search", searchType, product, intent, keywords, searchTrigger],
    queryFn: async () => {
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: searchTrigger > 0,
  });

  const handleSearch = () => {
    setSearchTrigger(prev => prev + 1);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Ferramenta de Teste</h3>
        <p className="text-sm text-blue-700">
          Use esta interface para testar as buscas na base de conhecimento. 
          Essas mesmas funções serão usadas pelos agentes de IA para enriquecer contexto.
        </p>
      </div>

      <div className="bg-white border rounded-lg p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setSearchType("combined")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
              searchType === "combined"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Search className="w-4 h-4" />
            Busca Combinada
          </button>
          <button
            onClick={() => setSearchType("product")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
              searchType === "product"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Package className="w-4 h-4" />
            Por Produto
          </button>
          <button
            onClick={() => setSearchType("category")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
              searchType === "category"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Tag className="w-4 h-4" />
            Por Categoria
          </button>
          <button
            onClick={() => setSearchType("keywords")}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
              searchType === "keywords"
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <FileText className="w-4 h-4" />
            Por Palavras-chave
          </button>
        </div>

        <div className="grid gap-3">
          {(searchType === "combined" || searchType === "product") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
              <input
                type="text"
                value={product}
                onChange={(e) => setProduct(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: Conta Digital, Cartão de Crédito"
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {(searchType === "combined" || searchType === "category") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Intent</label>
              <input
                type="text"
                value={intent}
                onChange={(e) => setIntent(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: Aumento de Limite, Bloqueio de Cartão"
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}

          {(searchType === "combined" || searchType === "keywords") && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Palavras-chave {searchType === "combined" && "(separadas por vírgula)"}
              </label>
              <input
                type="text"
                value={keywords}
                onChange={(e) => setKeywords(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ex: pix, transferência, limite"
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          )}
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Search className="w-4 h-4" />
          {isLoading ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-700">Erro ao buscar: {(error as Error).message}</p>
        </div>
      )}

      {data && (
        <div className="bg-white border rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50">
            <h3 className="text-sm font-medium text-gray-900">
              Resultados ({data.total} {data.total === 1 ? "artigo" : "artigos"})
            </h3>
          </div>

          {data.results.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>Nenhum artigo encontrado</p>
            </div>
          ) : (
            <div className="divide-y">
              {data.results.map((article) => (
                <div key={article.id} className="p-4 hover:bg-gray-50">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {article.productStandard || "Sem produto"}
                        </span>
                        {article.intent && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
                            {article.intent}
                          </span>
                        )}
                        {article.score !== undefined && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            Score: {article.score}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 mb-1">
                        {article.description || "Sem descrição"}
                      </p>
                      {article.resolution && (
                        <p className="text-sm text-gray-600">
                          <span className="font-medium">Resolução:</span> {article.resolution}
                        </p>
                      )}
                    </div>
                    <div className="text-xs text-gray-400">
                      #{article.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
