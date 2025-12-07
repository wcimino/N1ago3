import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Save, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { fetchApi, apiRequest } from "../../lib/queryClient";

interface ProductStandard {
  product: string;
  productStandard: string | null;
}

export function ProductStandardsSection() {
  const queryClient = useQueryClient();
  const [editedValues, setEditedValues] = useState<Record<string, string>>({});
  const [savingProduct, setSavingProduct] = useState<string | null>(null);
  const [savedProducts, setSavedProducts] = useState<Set<string>>(new Set());

  const { data: products, isLoading, error } = useQuery<ProductStandard[]>({
    queryKey: ["product-standards"],
    queryFn: () => fetchApi<ProductStandard[]>("/api/product-standards"),
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
        <AlertCircle className="w-5 h-5" />
        <span>Erro ao carregar produtos</span>
      </div>
    );
  }

  if (!products || products.length === 0) {
    return (
      <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-center">
        Nenhum produto encontrado nos resumos.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          <strong>Padronização de Produtos:</strong> Defina um nome padronizado para cada produto classificado pela IA. 
          O valor padronizado será usado nos relatórios e exports.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
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
              const isSaving = savingProduct === p.product;
              const isSaved = savedProducts.has(p.product);
              const hasChanges = editedValues[p.product] !== (p.productStandard || "");

              return (
                <tr key={p.product} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Package className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-900 font-medium">{p.product}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="text"
                      value={editedValues[p.product] || ""}
                      onChange={(e) => handleInputChange(p.product, e.target.value)}
                      placeholder="Digite o nome padronizado..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isSaved ? (
                      <span className="inline-flex items-center gap-1 text-green-600 text-sm">
                        <CheckCircle2 className="w-4 h-4" />
                        Salvo
                      </span>
                    ) : (
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
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
