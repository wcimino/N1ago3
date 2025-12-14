import { Search, Layers, Package, FileText, Target } from "lucide-react";
import { ExpandableSearchTool } from "../../../shared/components/ui";
import { useSearchTool } from "../hooks/useSearchTool";

interface CombinedResult {
  source: "article" | "problem";
  id: number;
  name: string | null;
  description: string;
  resolution?: string;
  matchScore?: number;
  matchReason?: string;
  products?: string[];
}

interface CombinedSearchResponse {
  message: string;
  results: CombinedResult[];
  resolvedFilters: {
    product: string | null;
  };
  articleCount: number;
  problemCount: number;
}

interface CombinedKnowledgeSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function CombinedKnowledgeSearchTool({ isExpanded, onToggle }: CombinedKnowledgeSearchToolProps) {
  const { values, setValue, isLoading, error, data, search, handleKeyPress } = useSearchTool<CombinedSearchResponse>({
    toolId: "combined-knowledge-search",
    endpoint: "/api/ai/tools/combined-search",
    fields: [
      { name: "product", label: "Produto", type: "text", required: true },
      { name: "keywords", label: "Palavras-chave", type: "text" },
    ],
  });

  const articleCount = data?.results?.filter(r => r.source === "article").length || 0;
  const problemCount = data?.results?.filter(r => r.source === "problem").length || 0;

  return (
    <ExpandableSearchTool
      title="search_knowledge_base_articles_and_problems"
      description="Busca artigos e problemas objetivos simultaneamente na base de conhecimento"
      icon={<Layers className="w-5 h-5 sm:w-6 sm:h-6 text-violet-600" />}
      iconBgColor="bg-violet-100"
      accentColor="violet"
      isExpanded={isExpanded}
      onToggle={onToggle}
      isLoading={isLoading}
      onSearch={search}
      error={error}
      helpText="Busca <strong>unificada</strong> que retorna artigos e problemas objetivos de uma só vez. Cada resultado indica sua origem (article ou problem)."
      resultsCount={data?.results?.length}
      resultsLabel="resultados"
      emptyMessage="Nenhum resultado encontrado"
      results={data && data.results && (
        <>
          <div className="px-3 py-2 bg-violet-50 border-b text-sm text-violet-700">
            {articleCount} artigos • {problemCount} problemas
            {data.resolvedFilters.product && (
              <span className="ml-2 text-xs text-violet-500">
                Filtro: {data.resolvedFilters.product}
              </span>
            )}
          </div>
          {data.results.map((result) => (
            <div key={`${result.source}-${result.id}`} className="p-3 hover:bg-gray-50">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                {result.source === "article" ? (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800 flex items-center gap-1">
                    <FileText className="w-3 h-3" />
                    Artigo
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800 flex items-center gap-1">
                    <Target className="w-3 h-3" />
                    Problema
                  </span>
                )}
                {result.name && (
                  <span className="font-medium text-gray-900">{result.name}</span>
                )}
                {result.matchScore !== undefined && result.matchScore > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                    {result.matchScore}% match
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {result.description}
              </p>
              {result.products && result.products.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Package className="w-3 h-3 text-gray-400" />
                  {result.products.slice(0, 3).map((prod, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                      {prod}
                    </span>
                  ))}
                  {result.products.length > 3 && (
                    <span className="text-xs text-gray-400">+{result.products.length - 3}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </>
      )}
    >
      <div className="grid gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produto <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <Package className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={values.product || ""}
              onChange={(e) => setValue("product", e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ex: Cartão de Crédito, Conta Digital"
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Palavras-chave (opcional)
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={values.keywords || ""}
              onChange={(e) => setValue("keywords", e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ex: cobrança indevida, limite"
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500"
            />
          </div>
        </div>
      </div>
    </ExpandableSearchTool>
  );
}
