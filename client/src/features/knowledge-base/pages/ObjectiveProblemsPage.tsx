import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, X, Check, AlertCircle, ChevronRight, ChevronDown } from "lucide-react";

interface Product {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

interface ObjectiveProblem {
  id: number;
  name: string;
  description: string;
  synonyms: string[];
  examples: string[];
  presentedBy: "customer" | "system" | "both";
  isActive: boolean;
  productIds: number[];
  createdAt: string;
  updatedAt: string;
}

interface FormData {
  name: string;
  description: string;
  synonyms: string;
  examples: string;
  presentedBy: "customer" | "system" | "both";
  isActive: boolean;
  productIds: number[];
}

const emptyForm: FormData = {
  name: "",
  description: "",
  synonyms: "",
  examples: "",
  presentedBy: "customer",
  isActive: true,
  productIds: [],
};

export function ObjectiveProblemsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const toggleExpanded = (productName: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) {
        next.delete(productName);
      } else {
        next.add(productName);
      }
      return next;
    });
  };

  const { data: problems = [], isLoading } = useQuery<ObjectiveProblem[]>({
    queryKey: ["/api/knowledge/objective-problems"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/objective-problems");
      if (!res.ok) throw new Error("Failed to fetch problems");
      return res.json();
    },
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/knowledge/objective-problems/products"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/objective-problems/products");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: FormData) => {
      const payload = {
        name: data.name,
        description: data.description,
        synonyms: data.synonyms.split("\n").map(s => s.trim()).filter(Boolean),
        examples: data.examples.split("\n").map(s => s.trim()).filter(Boolean),
        presentedBy: data.presentedBy,
        isActive: data.isActive,
        productIds: data.productIds,
      };
      const res = await fetch("/api/knowledge/objective-problems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to create problem");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/objective-problems"] });
      handleCancel();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: FormData }) => {
      const payload = {
        name: data.name,
        description: data.description,
        synonyms: data.synonyms.split("\n").map(s => s.trim()).filter(Boolean),
        examples: data.examples.split("\n").map(s => s.trim()).filter(Boolean),
        presentedBy: data.presentedBy,
        isActive: data.isActive,
        productIds: data.productIds,
      };
      const res = await fetch(`/api/knowledge/objective-problems/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to update problem");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/objective-problems"] });
      handleCancel();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/objective-problems/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete problem");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/objective-problems"] });
    },
  });

  const handleEdit = (problem: ObjectiveProblem) => {
    setEditingId(problem.id);
    setFormData({
      name: problem.name,
      description: problem.description,
      synonyms: problem.synonyms.join("\n"),
      examples: problem.examples.join("\n"),
      presentedBy: problem.presentedBy,
      isActive: problem.isActive,
      productIds: problem.productIds || [],
    });
    setShowForm(true);
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      updateMutation.mutate({ id: editingId, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const toggleProduct = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const getProductNames = (productIds: number[]) => {
    return productIds
      .map(id => products.find(p => p.id === id)?.fullName)
      .filter(Boolean)
      .join(", ");
  };

  const groupedProducts = products.reduce((acc, product) => {
    const mainProduct = product.produto;
    if (!acc[mainProduct]) {
      acc[mainProduct] = [];
    }
    acc[mainProduct].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const presentedByLabels = {
    customer: "Cliente",
    system: "Sistema",
    both: "Ambos",
  };

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {editingId ? "Editar Problema" : "Novo Problema"}
          </h3>
          <button onClick={handleCancel} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder="Ex: Transação recusada"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Descrição detalhada do problema"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produtos relacionados (opcional)
            </label>
            <div className="border border-gray-300 rounded-lg max-h-64 overflow-y-auto">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">Nenhum produto disponível</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(groupedProducts).map(([mainProduct, subProducts]) => {
                    const isExpanded = expandedProducts.has(mainProduct);
                    const generalProduct = subProducts.find(p => !p.subproduto);
                    const specificProducts = subProducts.filter(p => p.subproduto);
                    const selectedCount = subProducts.filter(p => formData.productIds.includes(p.id)).length;
                    
                    return (
                      <div key={mainProduct}>
                        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                          {specificProducts.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(mainProduct)}
                              className="p-0.5"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-gray-400" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-gray-400" />
                              )}
                            </button>
                          ) : (
                            <div className="w-5" />
                          )}
                          
                          {generalProduct && (
                            <input
                              type="checkbox"
                              checked={formData.productIds.includes(generalProduct.id)}
                              onChange={() => toggleProduct(generalProduct.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                          )}
                          
                          <span className="font-medium text-gray-900">{mainProduct}</span>
                          
                          {specificProducts.length > 0 && (
                            <span className="text-xs text-gray-400">
                              {specificProducts.length} subproduto{specificProducts.length !== 1 ? "s" : ""}
                            </span>
                          )}
                          
                          {selectedCount > 0 && (
                            <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                              {selectedCount}
                            </span>
                          )}
                        </div>
                        
                        {isExpanded && specificProducts.length > 0 && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {specificProducts.map((product) => (
                              <label
                                key={product.id}
                                className="flex items-center gap-2 px-3 py-2 pl-12 hover:bg-gray-100 cursor-pointer"
                              >
                                <input
                                  type="checkbox"
                                  checked={formData.productIds.includes(product.id)}
                                  onChange={() => toggleProduct(product.id)}
                                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">
                                  {product.subproduto}
                                </span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {formData.productIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formData.productIds.length} produto{formData.productIds.length !== 1 ? "s" : ""} selecionado{formData.productIds.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Sinônimos (um por linha)
            </label>
            <textarea
              value={formData.synonyms}
              onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Pagamento negado&#10;Recusa de cartão"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Exemplos de frases (um por linha)
            </label>
            <textarea
              value={formData.examples}
              onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              rows={3}
              placeholder="Meu cartão não passou&#10;Não consegui pagar"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Apresentado por</label>
            <select
              value={formData.presentedBy}
              onChange={(e) => setFormData({ ...formData, presentedBy: e.target.value as FormData["presentedBy"] })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            >
              <option value="customer">Cliente</option>
              <option value="system">Sistema</option>
              <option value="both">Ambos</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Ativo</label>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              {editingId ? "Atualizar" : "Criar"}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {problems.length} problema{problems.length !== 1 ? "s" : ""} cadastrado{problems.length !== 1 ? "s" : ""}
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Problema
        </button>
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando problemas...</div>
      ) : problems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>Nenhum problema cadastrado</p>
          <p className="text-sm">Clique em "Novo Problema" para adicionar</p>
        </div>
      ) : (
        <div className="space-y-3">
          {problems.map((problem) => (
            <div
              key={problem.id}
              className={`border rounded-lg p-4 ${problem.isActive ? "bg-white" : "bg-gray-50 opacity-75"}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h4 className="font-medium text-gray-900">{problem.name}</h4>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${
                      problem.presentedBy === "customer" ? "bg-blue-100 text-blue-700" :
                      problem.presentedBy === "system" ? "bg-orange-100 text-orange-700" :
                      "bg-purple-100 text-purple-700"
                    }`}>
                      {presentedByLabels[problem.presentedBy]}
                    </span>
                    {!problem.isActive && (
                      <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
                        Inativo
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600 mb-2">{problem.description}</p>
                  
                  {problem.productIds && problem.productIds.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">Produtos: </span>
                      <span className="text-xs text-green-700 font-medium">
                        {getProductNames(problem.productIds)}
                      </span>
                    </div>
                  )}
                  
                  {problem.synonyms.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs text-gray-500">Sinônimos: </span>
                      <span className="text-xs text-gray-700">{problem.synonyms.join(", ")}</span>
                    </div>
                  )}
                  
                  {problem.examples.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-500">Exemplos: </span>
                      <span className="text-xs text-gray-700 italic">"{problem.examples.join('", "')}"</span>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={() => handleEdit(problem)}
                    className="p-2 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded"
                    title="Editar"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm(`Tem certeza que deseja excluir "${problem.name}"?`)) {
                        deleteMutation.mutate(problem.id);
                      }
                    }}
                    className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
