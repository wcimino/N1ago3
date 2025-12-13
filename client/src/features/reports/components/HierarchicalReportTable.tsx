import { useState } from "react";
import { ChevronRight, ChevronDown, Loader2, AlertCircle, RefreshCw } from "lucide-react";

interface SubproductNode {
  subproduct: string;
  count: number;
}

interface ProductNode {
  product: string;
  count: number;
  subproducts: SubproductNode[];
}

interface ProblemNode {
  problem: string;
  count: number;
  products: ProductNode[];
}

interface HierarchicalReportTableProps {
  title: string;
  data: ProblemNode[];
  total: number;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onRetry: () => void;
}

export function HierarchicalReportTable({
  title,
  data,
  total,
  isLoading,
  isError,
  error,
  onRetry,
}: HierarchicalReportTableProps) {
  const [expandedProblems, setExpandedProblems] = useState<Set<string>>(new Set());
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const toggleProblem = (problem: string) => {
    setExpandedProblems((prev) => {
      const next = new Set(prev);
      if (next.has(problem)) {
        next.delete(problem);
      } else {
        next.add(problem);
      }
      return next;
    });
  };

  const toggleProduct = (key: string) => {
    setExpandedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const expandAll = () => {
    const allProblems = new Set(data.map((p) => p.problem));
    const allProducts = new Set(
      data.flatMap((p) =>
        p.products.map((prod) => `${p.problem}|${prod.product}`)
      )
    );
    setExpandedProblems(allProblems);
    setExpandedProducts(allProducts);
  };

  const collapseAll = () => {
    setExpandedProblems(new Set());
    setExpandedProducts(new Set());
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex flex-col items-center justify-center py-12 gap-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
          <p className="text-gray-600">
            {error?.message || "Erro ao carregar dados"}
          </p>
          <button
            onClick={onRetry}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-900 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg border">
        <div className="p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="flex items-center justify-center py-12">
          <p className="text-gray-500">Nenhum dado encontrado para o período</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500">
            {total.toLocaleString("pt-BR")} ocorrências em {data.length} problemas
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={expandAll}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Expandir tudo
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={collapseAll}
            className="text-sm text-blue-600 hover:text-blue-800 transition-colors"
          >
            Recolher tudo
          </button>
        </div>
      </div>

      <div className="divide-y">
        {data.map((problemNode) => {
          const isProblemExpanded = expandedProblems.has(problemNode.problem);

          return (
            <div key={problemNode.problem}>
              <button
                onClick={() => toggleProblem(problemNode.problem)}
                className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
              >
                {isProblemExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500 shrink-0" />
                )}
                <span className="font-medium text-gray-900 flex-1 truncate">
                  {problemNode.problem}
                </span>
                <span className="text-sm font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                  {problemNode.count.toLocaleString("pt-BR")}
                </span>
              </button>

              {isProblemExpanded && (
                <div className="border-t bg-gray-50/50">
                  {problemNode.products.map((productNode) => {
                    const productKey = `${problemNode.problem}|${productNode.product}`;
                    const isProductExpanded = expandedProducts.has(productKey);

                    return (
                      <div key={productKey}>
                        <button
                          onClick={() => toggleProduct(productKey)}
                          className="w-full flex items-center gap-2 pl-10 pr-4 py-2.5 hover:bg-gray-100 transition-colors text-left border-t first:border-t-0"
                        >
                          {isProductExpanded ? (
                            <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                          )}
                          <span className="text-gray-700 flex-1 truncate">
                            {productNode.product}
                          </span>
                          <span className="text-sm text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                            {productNode.count.toLocaleString("pt-BR")}
                          </span>
                        </button>

                        {isProductExpanded && (
                          <div className="border-t bg-gray-100/50">
                            {productNode.subproducts.map((subproductNode) => (
                              <div
                                key={`${productKey}|${subproductNode.subproduct}`}
                                className="flex items-center gap-2 pl-20 pr-4 py-2 text-left border-t first:border-t-0"
                              >
                                <span className="text-gray-600 flex-1 truncate text-sm">
                                  {subproductNode.subproduct}
                                </span>
                                <span className="text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                                  {subproductNode.count.toLocaleString("pt-BR")}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
