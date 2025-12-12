import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, AlertCircle, ChevronRight, ChevronDown, Minus } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";

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

interface ProductHierarchy {
  name: string;
  productId?: number;
  problems: ObjectiveProblem[];
  children: ProductHierarchy[];
}

export function ObjectiveProblemsPage() {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(emptyForm);
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const queryClient = useQueryClient();

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

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

  const filteredProblems = useMemo(() => {
    let result = problems;
    
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term) ||
        p.synonyms?.some(s => s.toLowerCase().includes(term)) ||
        p.examples?.some(e => e.toLowerCase().includes(term))
      );
    }
    
    if (selectedProduct) {
      const productIds = products
        .filter(p => p.produto === selectedProduct)
        .map(p => p.id);
      result = result.filter(problem => 
        problem.productIds?.some(id => productIds.includes(id))
      );
    }
    
    return result;
  }, [problems, searchTerm, selectedProduct, products]);

  const hierarchy = useMemo(() => {
    const productMap = new Map<string, ProductHierarchy>();
    const unassigned: ObjectiveProblem[] = [];
    
    const mainProducts = [...new Set(products.map(p => p.produto))];
    mainProducts.forEach(name => {
      productMap.set(name, { name, problems: [], children: [] });
    });
    
    filteredProblems.forEach(problem => {
      if (!problem.productIds || problem.productIds.length === 0) {
        unassigned.push(problem);
        return;
      }
      
      const problemProducts = products.filter(p => problem.productIds.includes(p.id));
      const addedToPaths = new Set<string>();
      
      problemProducts.forEach(product => {
        const productNode = productMap.get(product.produto);
        if (!productNode) return;
        
        if (product.subproduto) {
          const subPath = `${product.produto}|${product.subproduto}`;
          if (!addedToPaths.has(subPath)) {
            let subNode = productNode.children.find(c => c.name === product.subproduto);
            if (!subNode) {
              subNode = { name: product.subproduto, productId: product.id, problems: [], children: [] };
              productNode.children.push(subNode);
            }
            subNode.problems.push(problem);
            addedToPaths.add(subPath);
          }
        } else {
          if (!addedToPaths.has(product.produto)) {
            productNode.problems.push(problem);
            addedToPaths.add(product.produto);
          }
        }
      });
    });
    
    const result: ProductHierarchy[] = [];
    
    mainProducts.forEach(name => {
      const node = productMap.get(name);
      if (node && (node.problems.length > 0 || node.children.length > 0)) {
        result.push(node);
      }
    });
    
    if (unassigned.length > 0) {
      result.push({ name: "Sem produto", problems: unassigned, children: [] });
    }
    
    return result;
  }, [filteredProblems, products]);

  const distinctProducts = useMemo(() => {
    return [...new Set(products.map(p => p.produto))];
  }, [products]);

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

  const groupedProducts = products.reduce((acc, product) => {
    const mainProduct = product.produto;
    if (!acc[mainProduct]) {
      acc[mainProduct] = [];
    }
    acc[mainProduct].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedProduct("");
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-4">
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
                rows={2}
                placeholder="Descrição detalhada do problema"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sinônimos (um por linha)
                </label>
                <textarea
                  value={formData.synonyms}
                  onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  rows={4}
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
                  rows={4}
                  placeholder="Meu cartão não passou&#10;Não consegui pagar"
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Produtos relacionados (opcional)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
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
                            
                            <span className="font-medium text-gray-900 text-sm">{mainProduct}</span>
                            
                            {specificProducts.length > 0 && (
                              <span className="text-xs text-gray-400">
                                {specificProducts.length}
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
                                  className="flex items-center gap-2 px-3 py-1.5 pl-10 hover:bg-gray-100 cursor-pointer"
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
          </div>
        </form>
      </div>
    );
  }

  return (
    <>
      <FilterBar
        filters={[
          { type: "search", value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar..." },
          { type: "select", value: selectedProduct, onChange: setSelectedProduct, placeholder: "Produto", options: distinctProducts },
        ]}
        onClear={clearFilters}
      />

      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-sm text-gray-500">
            {filteredProblems.length} problema{filteredProblems.length !== 1 ? "s" : ""} {searchTerm || selectedProduct ? "encontrado" : "cadastrado"}{filteredProblems.length !== 1 ? "s" : ""}
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
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Nenhum problema {searchTerm || selectedProduct ? "encontrado" : "cadastrado"}</p>
            {!searchTerm && !selectedProduct && (
              <p className="text-sm">Clique em "Novo Problema" para adicionar</p>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {hierarchy.map((node) => {
              const isExpanded = expandedPaths.has(node.name);
              const hasContent = node.problems.length > 0 || node.children.length > 0;
              const totalProblems = node.problems.length + node.children.reduce((sum, c) => sum + c.problems.length, 0);
              
              return (
                <div key={node.name}>
                  <div 
                    className="flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => togglePath(node.name)}
                  >
                    {hasContent ? (
                      <button className="mt-0.5 p-0.5 hover:bg-gray-200 rounded shrink-0">
                        {isExpanded ? (
                          <Minus className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Plus className="w-4 h-4 text-gray-500" />
                        )}
                      </button>
                    ) : (
                      <div className="w-5 shrink-0" />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                        <span className="text-gray-900 text-base font-medium break-words">
                          {node.name}
                        </span>
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-purple-600">
                          <span className="font-medium">{totalProblems}</span> problema{totalProblems !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {isExpanded && (
                    <div className="ml-5 sm:ml-7 space-y-1">
                      {node.children.map((subNode) => {
                        const subPath = `${node.name}|${subNode.name}`;
                        const isSubExpanded = expandedPaths.has(subPath);
                        const hasSubProblems = subNode.problems.length > 0;
                        
                        return (
                          <div key={subPath}>
                            <div 
                              className="flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
                              onClick={() => togglePath(subPath)}
                            >
                              {hasSubProblems ? (
                                <button className="mt-0.5 p-0.5 hover:bg-gray-200 rounded shrink-0">
                                  {isSubExpanded ? (
                                    <Minus className="w-4 h-4 text-gray-500" />
                                  ) : (
                                    <Plus className="w-4 h-4 text-gray-500" />
                                  )}
                                </button>
                              ) : (
                                <div className="w-5 shrink-0" />
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                  <span className="text-gray-800 text-sm font-medium break-words">
                                    {subNode.name}
                                  </span>
                                  <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-purple-600">
                                    <span className="font-medium">{subNode.problems.length}</span> problema{subNode.problems.length !== 1 ? "s" : ""}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            {isSubExpanded && subNode.problems.length > 0 && (
                              <div className="ml-5 sm:ml-7 space-y-1">
                                {subNode.problems.map((problem) => (
                                  <div
                                    key={problem.id}
                                    className={`flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 group ${!problem.isActive ? "opacity-60" : ""}`}
                                  >
                                    <div className="w-5 shrink-0" />
                                    
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="text-sm font-medium text-gray-900 break-words">
                                          {problem.name}
                                        </span>
                                        {!problem.isActive && (
                                          <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                                            Inativo
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                      <button
                                        onClick={(e) => { e.stopPropagation(); handleEdit(problem); }}
                                        className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded"
                                        title="Editar"
                                      >
                                        <Pencil className="w-4 h-4" />
                                      </button>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (confirm(`Tem certeza que deseja excluir "${problem.name}"?`)) {
                                            deleteMutation.mutate(problem.id);
                                          }
                                        }}
                                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                                        title="Excluir"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                      
                      {node.problems.map((problem) => (
                        <div
                          key={problem.id}
                          className={`flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 group ${!problem.isActive ? "opacity-60" : ""}`}
                        >
                          <div className="w-5 shrink-0" />
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-gray-900 break-words">
                                {problem.name}
                              </span>
                              {!problem.isActive && (
                                <span className="px-1.5 py-0.5 text-xs rounded bg-gray-100 text-gray-500">
                                  Inativo
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleEdit(problem); }}
                              className="p-1.5 text-gray-400 hover:text-purple-500 hover:bg-purple-50 rounded"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(`Tem certeza que deseja excluir "${problem.name}"?`)) {
                                  deleteMutation.mutate(problem.id);
                                }
                              }}
                              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
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
    </>
  );
}
