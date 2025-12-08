import { useState } from "react";
import { Search, FileText, Tag, Package, BookOpen, Database, ChevronDown, ChevronUp } from "lucide-react";
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

interface ProductResult {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
}

export function ToolsPage() {
  const [expandedTool, setExpandedTool] = useState<string | null>(null);
  
  const [kbSearchType, setKbSearchType] = useState<KBSearchType>("combined");
  const [kbProduct, setKbProduct] = useState("");
  const [kbIntent, setKbIntent] = useState("");
  const [kbKeywords, setKbKeywords] = useState("");
  const [kbSearchTrigger, setKbSearchTrigger] = useState(0);

  const [productQuery, setProductQuery] = useState("");
  const [productSearchTrigger, setProductSearchTrigger] = useState(0);

  const buildKBSearchParams = () => {
    const params = new URLSearchParams();
    params.set("limit", "10");

    switch (kbSearchType) {
      case "combined":
        if (kbProduct) params.set("product", kbProduct);
        if (kbIntent) params.set("intent", kbIntent);
        if (kbKeywords) params.set("keywords", kbKeywords);
        return { endpoint: "/api/knowledge-base-search", params };
      case "product":
        params.set("q", kbProduct);
        return { endpoint: "/api/knowledge-base-search/product", params };
      case "category":
        params.set("category1", kbIntent);
        return { endpoint: "/api/knowledge-base-search/category", params };
      case "keywords":
        params.set("q", kbKeywords);
        return { endpoint: "/api/knowledge-base-search/keywords", params };
      default:
        return { endpoint: "/api/knowledge-base-search", params };
    }
  };

  const { endpoint: kbEndpoint, params: kbParams } = buildKBSearchParams();

  const { data: kbData, isLoading: kbLoading, error: kbError } = useQuery<KBSearchResponse>({
    queryKey: ["knowledge-search", kbSearchType, kbProduct, kbIntent, kbKeywords, kbSearchTrigger],
    queryFn: async () => {
      const res = await fetch(`${kbEndpoint}?${kbParams.toString()}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: kbSearchTrigger > 0 && expandedTool === "knowledge_base",
  });

  const { data: productData, isLoading: productLoading, error: productError } = useQuery<ProductResult[]>({
    queryKey: ["product-catalog-search", productQuery, productSearchTrigger],
    queryFn: async () => {
      const res = await fetch(`/api/product-catalog?q=${encodeURIComponent(productQuery)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Falha na busca");
      return res.json();
    },
    enabled: productSearchTrigger > 0 && expandedTool === "product_catalog",
  });

  const handleKBSearch = () => {
    setKbSearchTrigger(prev => prev + 1);
  };

  const handleProductSearch = () => {
    setProductSearchTrigger(prev => prev + 1);
  };

  const handleKeyPress = (e: React.KeyboardEvent, searchFn: () => void) => {
    if (e.key === "Enter") {
      searchFn();
    }
  };

  const toggleTool = (tool: string) => {
    setExpandedTool(expandedTool === tool ? null : tool);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">Ferramentas de IA</h3>
        <p className="text-sm text-blue-700">
          Use esta interface para testar as ferramentas disponíveis para os agentes de IA. 
          Essas mesmas funções são usadas automaticamente quando habilitadas nas configurações de cada agente.
        </p>
      </div>

      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleTool("knowledge_base")}
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
            {expandedTool === "knowledge_base" ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedTool === "knowledge_base" && (
          <div className="border-t bg-white p-4 sm:p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Usada pelo agente de <strong>Resposta</strong> para enriquecer contexto com artigos da base.
            </p>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setKbSearchType("combined")}
                className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
                  kbSearchType === "combined"
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Search className="w-4 h-4" />
                Busca Combinada
              </button>
              <button
                onClick={() => setKbSearchType("product")}
                className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
                  kbSearchType === "product"
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Package className="w-4 h-4" />
                Por Produto
              </button>
              <button
                onClick={() => setKbSearchType("category")}
                className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
                  kbSearchType === "category"
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <Tag className="w-4 h-4" />
                Por Categoria
              </button>
              <button
                onClick={() => setKbSearchType("keywords")}
                className={`px-3 py-1.5 text-sm rounded-md flex items-center gap-1.5 ${
                  kbSearchType === "keywords"
                    ? "bg-indigo-100 text-indigo-700 font-medium"
                    : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}
              >
                <FileText className="w-4 h-4" />
                Por Palavras-chave
              </button>
            </div>

            <div className="grid gap-3">
              {(kbSearchType === "combined" || kbSearchType === "product") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Produto</label>
                  <input
                    type="text"
                    value={kbProduct}
                    onChange={(e) => setKbProduct(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, handleKBSearch)}
                    placeholder="Ex: Conta Digital, Cartão de Crédito"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}

              {(kbSearchType === "combined" || kbSearchType === "category") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Intenção</label>
                  <select
                    value={kbIntent}
                    onChange={(e) => setKbIntent(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="">Todas</option>
                    <option value="suporte">suporte</option>
                    <option value="contratar">contratar</option>
                  </select>
                </div>
              )}

              {(kbSearchType === "combined" || kbSearchType === "keywords") && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Palavras-chave {kbSearchType === "combined" && "(separadas por vírgula)"}
                  </label>
                  <input
                    type="text"
                    value={kbKeywords}
                    onChange={(e) => setKbKeywords(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, handleKBSearch)}
                    placeholder="Ex: pix, transferência, limite"
                    className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>
              )}
            </div>

            <button
              onClick={handleKBSearch}
              disabled={kbLoading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              {kbLoading ? "Buscando..." : "Buscar"}
            </button>

            {kbError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">Erro ao buscar: {(kbError as Error).message}</p>
              </div>
            )}

            {kbData && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-900">
                    Resultados ({kbData.total} {kbData.total === 1 ? "artigo" : "artigos"})
                  </h4>
                </div>

                {kbData.results.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Nenhum artigo encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {kbData.results.map((article) => (
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

      <div className="bg-gray-50 rounded-lg overflow-hidden">
        <button
          onClick={() => toggleTool("product_catalog")}
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
            {expandedTool === "product_catalog" ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </button>

        {expandedTool === "product_catalog" && (
          <div className="border-t bg-white p-4 sm:p-6 space-y-4">
            <p className="text-sm text-gray-600">
              Usada pelo agente de <strong>Aprendizado</strong> para buscar classificações válidas no catálogo de produtos.
            </p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Buscar produto</label>
              <input
                type="text"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
                onKeyPress={(e) => handleKeyPress(e, handleProductSearch)}
                placeholder="Ex: Antecipação, Cartão, Conta Digital..."
                className="w-full px-3 py-2 border rounded-md text-sm focus:ring-2 focus:ring-green-500 focus:border-green-500"
              />
            </div>

            <button
              onClick={handleProductSearch}
              disabled={productLoading}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Search className="w-4 h-4" />
              {productLoading ? "Buscando..." : "Buscar"}
            </button>

            {productError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">Erro ao buscar: {(productError as Error).message}</p>
              </div>
            )}

            {productData && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-2 border-b bg-gray-50">
                  <h4 className="text-sm font-medium text-gray-900">
                    Resultados ({productData.length} {productData.length === 1 ? "produto" : "produtos"})
                  </h4>
                </div>

                {productData.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">
                    <Database className="w-10 h-10 mx-auto mb-2 text-gray-300" />
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </div>
                ) : (
                  <div className="divide-y max-h-64 overflow-y-auto">
                    {productData.map((product) => (
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
    </div>
  );
}
