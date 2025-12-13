import { Database } from "lucide-react";
import { ExpandableSearchTool } from "../../../shared/components/ui";
import { useSearchTool } from "../hooks/useSearchTool";

interface ProductResult {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

interface ProductCatalogSearchToolProps {
  isExpanded: boolean;
  onToggle: () => void;
}

export function ProductCatalogSearchTool({ isExpanded, onToggle }: ProductCatalogSearchToolProps) {
  const { values, setValue, isLoading, error, data, search, handleKeyPress } = useSearchTool<ProductResult[]>({
    toolId: "product-catalog-search",
    endpoint: "/api/product-catalog",
    fields: [{ name: "q", label: "Buscar produto", type: "text" }],
    transformParams: (v) => ({ q: v.q }),
  });

  return (
    <ExpandableSearchTool
      title="search_product_catalog"
      description="Busca produtos no catálogo hierárquico para auto-categorização"
      icon={<Database className="w-5 h-5 sm:w-6 sm:h-6 text-green-600" />}
      iconBgColor="bg-green-100"
      accentColor="green"
      isExpanded={isExpanded}
      onToggle={onToggle}
      isLoading={isLoading}
      onSearch={search}
      error={error}
      helpText="Usada pelo agente de <strong>Aprendizado</strong> para buscar classificações válidas no catálogo de produtos."
      resultsCount={data?.length}
      resultsLabel="produtos"
      emptyIcon={<Database className="w-10 h-10 mx-auto mb-2 text-gray-300" />}
      emptyMessage="Nenhum produto encontrado"
      results={data && (
        <>
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
              </div>
              <p className="text-sm text-gray-600 font-mono">
                {product.fullName}
              </p>
            </div>
          ))}
        </>
      )}
    >
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Buscar produto</label>
        <input
          type="text"
          value={values.q || ""}
          onChange={(e) => setValue("q", e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ex: Antecipação, Cartão, Conta Digital..."
          className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
        />
      </div>
    </ExpandableSearchTool>
  );
}
