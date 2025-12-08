import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Trash2, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

interface IfoodProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string;
  categoria2: string | null;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  produto: string;
  subproduto: string;
  categoria1: string;
  categoria2: string;
}

const emptyForm: FormData = {
  produto: "",
  subproduto: "",
  categoria1: "",
  categoria2: "",
};

export function IfoodProductsSection() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: products, isLoading } = useQuery<IfoodProduct[]>({
    queryKey: ["ifood-products"],
    queryFn: () => fetchApi<IfoodProduct[]>("/api/ifood-products"),
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      return apiRequest("POST", "/api/ifood-products", {
        produto: data.produto,
        subproduto: data.subproduto || null,
        categoria1: data.categoria1,
        categoria2: data.categoria2 || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ifood-products"] });
      queryClient.invalidateQueries({ queryKey: ["ifood-products-fullnames"] });
      setFormData(emptyForm);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao criar produto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ifood-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ifood-products"] });
      queryClient.invalidateQueries({ queryKey: ["ifood-products-fullnames"] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.produto.trim()) {
      setError("Produto é obrigatório");
      return;
    }
    if (!formData.categoria1.trim()) {
      setError("Categoria 1 é obrigatória");
      return;
    }

    createMutation.mutate(formData);
  };

  const handleChange = (field: keyof FormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const groupedProducts = products?.reduce((acc, product) => {
    const key = product.produto;
    if (!acc[key]) acc[key] = [];
    acc[key].push(product);
    return acc;
  }, {} as Record<string, IfoodProduct[]>);

  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <h3 className="text-md font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <Package className="w-5 h-5" />
        Produtos iFood Pago
      </h3>
      <p className="text-sm text-gray-600 mb-4">
        Cadastre os produtos disponíveis no iFood Pago. Estes valores serão usados como opções na padronização de produtos.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produto <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.produto}
              onChange={(e) => handleChange("produto", e.target.value)}
              placeholder="Ex: Antecipação"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Subproduto <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.subproduto}
              onChange={(e) => handleChange("subproduto", e.target.value)}
              placeholder="Ex: Recebíveis"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria 1 <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.categoria1}
              onChange={(e) => handleChange("categoria1", e.target.value)}
              placeholder="Ex: Solicitação"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Categoria 2 <span className="text-gray-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={formData.categoria2}
              onChange={(e) => handleChange("categoria2", e.target.value)}
              placeholder="Ex: Aprovação"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {showSuccess && (
          <div className="flex items-center gap-2 text-green-600 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            Produto cadastrado com sucesso!
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={createMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
          >
            {createMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Adicionar Produto
          </button>
        </div>
      </form>

      <div className="border-t border-gray-200 pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Produtos Cadastrados</h4>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : !products || products.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">Nenhum produto cadastrado ainda.</p>
          </div>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {Object.entries(groupedProducts || {}).map(([produto, items]) => (
              <div key={produto} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                <div className="bg-gray-100 px-3 py-2 border-b border-gray-200">
                  <span className="font-medium text-gray-900 text-sm">{produto}</span>
                  <span className="text-gray-500 text-xs ml-2">({items.length} item{items.length > 1 ? 's' : ''})</span>
                </div>
                <div className="divide-y divide-gray-100">
                  {items.map((item) => (
                    <div key={item.id} className="px-3 py-2 flex items-center justify-between hover:bg-gray-50">
                      <div className="flex-1">
                        <span className="text-sm text-gray-700">{item.fullName}</span>
                      </div>
                      <button
                        onClick={() => deleteMutation.mutate(item.id)}
                        disabled={deleteMutation.isPending}
                        className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                        title="Excluir"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
