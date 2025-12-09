import { useState } from "react";
import { Search, FileText, Tag, Package, BookOpen } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { ExpandableSearchTool } from "../../../shared/components/ui";

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

const SEARCH_TYPE_BUTTONS = [
  { id: "combined" as const, label: "Busca Combinada", icon: Search },
  { id: "product" as const, label: "Por Produto", icon: Package },
  { id: "category" as const, label: "Por Categoria", icon: Tag },
  { id: "keywords" as const, label: "Por Palavras-chave", icon: FileText },
];

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
    <ExpandableSearchTool
      title="search_knowledge_base"
      description="Busca artigos na base de conhecimento por produto, intenção e palavras-chave"
      icon={<BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />}
      iconBgColor="bg-indigo-100"
      accentColor="indigo"
      isExpanded={isExpanded}
      onToggle={onToggle}
      isLoading={isLoading}
      onSearch={handleSearch}
      error={error as Error | null}
      helpText="Usada pelo agente de <strong>Resposta</strong> para enriquecer contexto com artigos da base."
      resultsCount={data?.total}
      resultsLabel="artigos"
      emptyMessage="Nenhum artigo encontrado"
      results={data && (
        <>
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
        </>
      )}
    >
      <div className="flex flex-wrap gap-2">
        {SEARCH_TYPE_BUTTONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSearchType(id)}
            className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
              searchType === id
                ? "bg-indigo-100 text-indigo-700 font-medium"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
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
    </ExpandableSearchTool>
  );
}
