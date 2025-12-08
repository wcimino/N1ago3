import { useState } from "react";
import { Search, Database, ChevronDown, ChevronUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface ProductResult {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
}

interface ProductCatalogSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ProductCatalogSearchTool({ isExpanded, onToggle }: ProductCatalogSearchToolProps) {
  const [query, setQuery] = useState("");
  const [searchTrigger, setSearchTrigger] = useState(0);

  const { data, isLoading, error } = useQuery<ProductResult[]>({
    queryKey: ["product-catalog-search", query, searchTrigger],
    queryFn: async () => {
      const res = await fetch(`/api/product-catalog?q=${encodeURIComponent(query)}`, {
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
        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
          <Database className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900">search_product_catalog</h3>
          <p className="text-sm text-gray-600">Busca produtos no catálogo hierárquico para auto-categorização</p>
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
            Usada pelo agente de <strong>Aprendizado</strong> para buscar classificações válidas no catálogo de produtos.
          </p>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar produto</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ex: Antecipação, Cartão, Conta Digital..."
              className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
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
                  Resultados ({data.length} {data.length === 1 ? "produto" : "produtos"})
                </h4>
              </div>

              {data.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  <Database className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                  <p className="text-sm">Nenhum produto encontrado</p>
                </div>
              ) : (
                <div className="divide-y max-h-64 overflow-y-auto">
                  {data.map((product) => (
                    <div key={product.id} className="p-3 hover:bg-gray-50">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                          {product.produto}
                        </span>
                        {product.subproduto && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                            {product.subproduto}
                          </span>
                        )}
                        {product.categoria1 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            {product.categoria1}
                          </span>
                        )}
                        {product.categoria2 && (
                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-700">
                            {product.categoria2}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 font-mono">
                        {product.fullName}
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
