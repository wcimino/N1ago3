import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Package, Save, Loader2, CheckCircle2, AlertCircle, ArrowLeft, ChevronDown } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

interface ProductStandard {
  product: string;
  productStandard: string | null;
}

export function ProductStandardsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [savedProducts, setSavedProducts] = useState<Set<string>>(new Set());

  const { data: products, isLoading, error } = useQuery<ProductStandard[]>({
    queryKey: ["product-standards"],
    queryFn: () => fetchApi<ProductStandard[]>("/api/product-standards"),
  });

  const { data: catalogProductNames } = useQuery<string[]>({
    queryKey: ["product-catalog-distinct-produtos"],
    queryFn: () => fetchApi<string[]>("/api/product-catalog/distinct/produtos"),
  });

  useEffect(() => {
    if (products) {
      const initial: Record<string, string> = {};
      products.forEach((p) => {
        initial[p.product] = p.productStandard || "";
      });
      setEditedValues(initial);
    }
  }, [products]);

  const saveMutation = useMutation({
    mutationFn: async ({ product, productStandard }: { product: string; productStandard: string }) => {
      return apiRequest("PUT", "/api/product-standards", { product, productStandard });
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["product-standards"] });
      setSavedProducts((prev) => new Set([...prev, variables.product]));
      setTimeout(() => {
        setSavedProducts((prev) => {
          const next = new Set(prev);
          next.delete(variables.product);
          return next;
        });
      }, 2000);
    },
  });

  const handleSave = async (product: string) => {
    const value = editedValues[product];
    if (!value || value.trim() === "") return;
    
    setSavingProduct(product);
    try {
      await saveMutation.mutateAsync({ product, productStandard: value.trim() });
    } finally {
      setSavingProduct(null);
    }
  };

  const handleInputChange = (product: string, value: string) => {
    setEditedValues((prev) => ({ ...prev, [product]: value }));
  };

  const renderSaveButton = (p: ProductStandard) => {
    const isSaving = savingProduct === p.product;
    const isSaved = savedProducts.has(p.product);
    const hasChanges = editedValues[p.product] !== (p.productStandard || "");

    if (isSaved) {
      return (
        <span className="inline-flex items-center gap-1 text-green-600 text-sm">
          <CheckCircle2 className="w-4 h-4" />
          Salvo
        </span>
      );
    }

    return (
      <button
        onClick={() => handleSave(p.product)}
        disabled={isSaving || !editedValues[p.product]?.trim()}
        className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
          hasChanges && editedValues[p.product]?.trim()
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-100 text-gray-400 cursor-not-allowed"
        } disabled:opacity-50`}
      >
        {isSaving ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <Save className="w-4 h-4" />
        )}
        Salvar
      </button>
    );
  };

  const renderProductSelect = (p: ProductStandard, needsMapping: boolean = false) => {
    const hasOptions = catalogProductNames && catalogProductNames.length > 0;
    const currentValue = editedValues[p.product] || "";
    const showRedBorder = needsMapping && !currentValue;
    
    return (
      <div className="relative">
        <select
          value={currentValue}
          onChange={(e) => handleInputChange(p.product, e.target.value)}
          className={`w-full px-3 py-2 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm appearance-none bg-white pr-10 ${
            showRedBorder 
              ? 'border-2 border-red-400 text-red-600' 
              : 'border border-gray-300 text-gray-900'
          } ${!hasOptions ? 'text-gray-400' : ''}`}
          disabled={!hasOptions}
        >
          <option value="">
            {hasOptions ? "Selecione um produto padronizado..." : "Nenhum produto cadastrado"}
          </option>
          {catalogProductNames?.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <ChevronDown className={`absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none ${showRedBorder ? 'text-red-400' : 'text-gray-400'}`} />
      </div>
    );
  };

  const renderMobileCard = (p: ProductStandard) => {
    const needsMapping = !p.productStandard;
    return (
      <div key={p.product} className={`p-4 border-b last:border-b-0 ${needsMapping ? 'bg-red-50' : 'bg-white'}`}>
        <div className="flex items-center gap-2 mb-3">
          <Package className={`w-4 h-4 ${needsMapping ? 'text-red-400' : 'text-gray-400'}`} />
          <span className={`text-sm font-medium ${needsMapping ? 'text-red-700' : 'text-gray-900'}`}>{p.product}</span>
        </div>
        <div className="space-y-3">
          {renderProductSelect(p, needsMapping)}
          <div className="flex justify-end">
            {renderSaveButton(p)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/settings/maintenance")}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Padronização de Produtos</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Defina nomes padronizados para os produtos classificados pela IA</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
          </div>
        ) : error ? (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="w-5 h-5" />
            <span>Erro ao carregar produtos</span>
          </div>
        ) : !products || products.length === 0 ? (
          <div className="p-8 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-center">
            <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="font-medium">Nenhum produto encontrado</p>
            <p className="text-sm mt-1">Os produtos serão listados quando a IA classificar conversas.</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Instruções:</strong> Para cada produto classificado pela IA, selecione um nome padronizado da lista. 
                Os produtos disponíveis são cadastrados em <strong>Configurações Gerais → Produtos iFood Pago</strong>.
              </p>
            </div>

            <div className="hidden md:block border border-gray-200 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Produto Original
                    </th>
                    <th className="px-4 py-3 text-left text-sm font-medium text-gray-700">
                      Nome Padronizado
                    </th>
                    <th className="px-4 py-3 text-right text-sm font-medium text-gray-700 w-24">
                      Ação
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {products.map((p) => {
                    const needsMapping = !p.productStandard;
                    return (
                      <tr key={p.product} className={`hover:bg-gray-50 ${needsMapping ? 'bg-red-50' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Package className={`w-4 h-4 ${needsMapping ? 'text-red-400' : 'text-gray-400'}`} />
                            <span className={`text-sm font-medium ${needsMapping ? 'text-red-700' : 'text-gray-900'}`}>{p.product}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {renderProductSelect(p, needsMapping)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {renderSaveButton(p)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="md:hidden border border-gray-200 rounded-lg overflow-hidden">
              {products.map(renderMobileCard)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
