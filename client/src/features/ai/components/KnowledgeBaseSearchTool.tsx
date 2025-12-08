import { useState } from "react";
import { Search, FileText, Tag, Package, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

type KBSearchType = "combined" | "product" | "category" | "keywords";

interface KBSearchResult {
  id: number;
  productStandard: string | null;
  subproductStandard: string | null;
  intent: string | null;
  description: string | null;
  resolution: string | null;
  score?: number;
}

interface KBSearchResponse {
  results: KBSearchResult[];
  total: number;
}

interface KnowledgeBaseSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function KnowledgeBaseSearchTool({ isExpanded, onToggle }: KnowledgeBaseSearchToolProps) {
  const [searchType, setSearchType] = useState<KBSearchType>("combined");
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

  const { data, isLoading, error } = useQuery<KBSearchResponse>({
    queryKey: ["knowledge-search", searchType, product, intent, keywords, searchTrigger],
    queryFn: async () => {
      const res = await fetch(`${endpoint}?${params.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: searchTrigger > 0 && isExpanded,
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
    <div className="bg-gray-50 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full p-4 sm:p-6 flex items-center gap-4 hover:bg-gray-100 transition-colors"
      >
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-indigo-100 rounded-lg flex items-center justify-center shrink-0">
          <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">search_knowledge_base</h3>
          <p className="text-sm text-gray-600">Busca artigos na base de conhecimento por produto, intenção e palavras-chave</p>
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
          <p className="text-sm text-gray-600">
            Usada pelo agente de <strong>Resposta</strong> para enriquecer contexto com artigos da base.
          </p>

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Intenção</label>
                <select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  <option value="">Todas</option>
                  <option value="suporte">suporte</option>
                  <option value="contratar">contratar</option>
                </select>
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

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-700">Erro ao buscar: {(error as Error).message}</p>
            </div>
          )}

          {data && (
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-2 border-b bg-gray-50">
                <h4 className="text-sm font-medium text-gray-900">
                  Resultados ({data.total} {data.total === 1 ? "artigo" : "artigos"})
                </h4>
              </div>

              {data.results.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhum artigo encontrado</p>
                </div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {data.results.map((article) => (
                    <div key={article.id} className="p-3 hover:bg-gray-50">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          {article.productStandard || "Sem produto"}
                        </span>
                        {article.intent && (
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            article.intent === "contratar" 
                              ? "bg-green-100 text-green-700" 
                              : "bg-gray-100 text-gray-700"
                          }`}>
                            {article.intent}
                          </span>
                        )}
                        {article.score !== undefined && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                            Score: {article.score}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-700 line-clamp-2">
                        {article.description}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
