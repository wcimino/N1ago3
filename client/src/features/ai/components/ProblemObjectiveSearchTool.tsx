import { Search, Target, Package } from "lucide-react";
import { ExpandableSearchTool } from "../../../shared/components/ui";
import { useSearchTool } from "../hooks/useSearchTool";

interface ProblemResult {
  id: number;
  name: string;
  matchScore: number;
  matchReason: string;
  description: string;
  synonyms: string[];
  examples: string[];
  products: string[];
}

interface ProblemSearchResponse {
  message: string;
  problems: ProblemResult[];
}

interface ProblemObjectiveSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ProblemObjectiveSearchTool({ isExpanded, onToggle }: ProblemObjectiveSearchToolProps) {
  const { values, setValue, isLoading, error, data, search, handleKeyPress } = useSearchTool<ProblemSearchResponse>({
    toolId: "problem-objective-search",
    endpoint: "/api/knowledge/objective-problems/search",
    fields: [
      { name: "keywords", label: "Palavras-chave", type: "text" },
      { name: "product", label: "Produto", type: "text" },
    ],
  });

  return (
    <ExpandableSearchTool
      title="search_knowledge_base_problem_objective"
      description="Busca problemas objetivos na base de conhecimento para identificar o problema real do cliente"
      icon={<Target className="w-5 h-5 sm:w-6 sm:h-6 text-rose-600" />}
      iconBgColor="bg-rose-100"
      accentColor="rose"
      isExpanded={isExpanded}
      onToggle={onToggle}
      isLoading={isLoading}
      onSearch={search}
      error={error}
      helpText="Usada pelo agente para identificar qual é o <strong>problema real</strong> do cliente baseado no que ele descreve."
      resultsCount={data?.problems?.length}
      resultsLabel="problemas"
      emptyMessage="Nenhum problema objetivo encontrado"
      results={data && data.problems && (
        <>
          {data.problems.map((problem) => (
            <div key={problem.id} className="p-3 hover:bg-gray-50">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="font-medium text-gray-900">{problem.name}</span>
                {problem.matchScore > 0 && (
                  <span className="px-2 py-0.5 rounded text-xs font-medium bg-rose-100 text-rose-800">
                    {problem.matchScore}% match
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-2">
                {problem.description}
              </p>
              {problem.products && problem.products.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap">
                  <Package className="w-3 h-3 text-gray-400" />
                  {problem.products.slice(0, 3).map((prod, idx) => (
                    <span key={idx} className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                      {prod}
                    </span>
                  ))}
                  {problem.products.length > 3 && (
                    <span className="text-xs text-gray-400">+{problem.products.length - 3}</span>
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
            Palavras-chave
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={values.keywords || ""}
              onChange={(e) => setValue("keywords", e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ex: cobrança indevida, cancelar pedido"
              className="w-full pl-10 pr-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Produto (opcional)
          </label>
          <input
            type="text"
            value={values.product || ""}
            onChange={(e) => setValue("product", e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ex: Cartão de Crédito, Conta Digital"
            className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-rose-500 focus:border-rose-500"
          />
        </div>
      </div>
    </ExpandableSearchTool>
  );
}
