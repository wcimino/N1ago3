import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, Check, AlertCircle, ChevronRight, ChevronDown, Minus, Loader2 } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { FormField } from "../../../shared/components/crud";
import { useCrudMutations } from "../../../shared/hooks";
import { apiRequest } from "../../../lib/queryClient";

interface ObjectiveProblemStats {
  totalProblems: number;
  activeProblems: number;
  withEmbedding: number;
  withoutEmbedding: number;
}

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

const transformFormData = (data: FormData) => ({
  name: data.name,
  description: data.description,
  synonyms: data.synonyms.split("\n").map(s => s.trim()).filter(Boolean),
  examples: data.examples.split("\n").map(s => s.trim()).filter(Boolean),
  presentedBy: data.presentedBy,
  isActive: data.isActive,
  productIds: data.productIds,
});

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
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const toggleExpanded = (productName: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  };

  const { data: problems = [], isLoading } = useQuery<ObjectiveProblem[]>({
    queryKey: ["/api/knowledge/objective-problems"],
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/knowledge/objective-problems/products"],
  });

  const { data: stats, refetch: refetchStats } = useQuery<ObjectiveProblemStats>({
    queryKey: ["/api/knowledge/objective-problems/stats"],
  });

  const generateEmbeddingsMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/knowledge/objective-problems/embeddings/generate-all");
      return res.json();
    },
    onSuccess: () => refetchStats(),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const { handleCreate, handleUpdate, handleDelete, isMutating, isDeleting } = useCrudMutations<FormData, FormData>({
    baseUrl: "/api/knowledge/objective-problems",
    queryKeys: ["/api/knowledge/objective-problems", "/api/knowledge/objective-problems/stats"],
    transformCreateData: transformFormData,
    transformUpdateData: transformFormData,
    onCreateSuccess: resetForm,
    onUpdateSuccess: resetForm,
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      handleUpdate(editingId, formData);
    } else {
      handleCreate(formData);
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
    if (!acc[mainProduct]) acc[mainProduct] = [];
    acc[mainProduct].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedProduct("");
  };

  const renderProblemItem = (problem: ObjectiveProblem) => (
    <div
      key={problem.id}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg border ${
        problem.isActive ? "bg-white border-gray-200" : "bg-gray-50 border-gray-200"
      }`}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-900 truncate">{problem.name}</span>
          {!problem.isActive && (
            <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">Inativo</span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{problem.description}</p>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        <button
          onClick={() => handleEdit(problem)}
          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleDelete(problem.id, "Tem certeza que deseja excluir este problema?")}
          disabled={isDeleting}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded disabled:opacity-50"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  const renderProductNode = (node: ProductHierarchy, path: string, depth: number = 0) => {
    const isExpanded = expandedPaths.has(path);
    const hasChildren = node.children.length > 0 || node.problems.length > 0;
    const totalProblems = node.problems.length + node.children.reduce((sum, c) => sum + c.problems.length, 0);

    return (
      <div key={path} className={depth > 0 ? "ml-4" : ""}>
        <div
          className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg cursor-pointer hover:bg-gray-100"
          onClick={() => hasChildren && togglePath(path)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <Minus className="w-4 h-4 text-gray-300" />
          )}
          <span className="font-medium text-gray-700">{node.name}</span>
          <span className="text-xs text-gray-400">({totalProblems})</span>
        </div>
        
        {isExpanded && (
          <div className="mt-2 space-y-2 ml-4">
            {node.problems.map(renderProblemItem)}
            {node.children.map(child => renderProductNode(child, `${path}|${child.name}`, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  if (showForm) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">
            {editingId ? "Editar Problema" : "Novo Problema"}
          </h3>
          <button onClick={resetForm} className="p-2 text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
          <div className="space-y-4">
            <FormField
              type="text"
              label="Nome"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Ex: Transacao recusada"
            />

            <FormField
              type="textarea"
              label="Descricao"
              required
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              placeholder="Descricao detalhada do problema"
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                type="textarea"
                label="Sinonimos (um por linha)"
                value={formData.synonyms}
                onChange={(e) => setFormData({ ...formData, synonyms: e.target.value })}
                rows={4}
                placeholder="Pagamento negado&#10;Recusa de cartao"
              />

              <FormField
                type="textarea"
                label="Exemplos de frases (um por linha)"
                value={formData.examples}
                onChange={(e) => setFormData({ ...formData, examples: e.target.value })}
                rows={4}
                placeholder="Meu cartao nao passou&#10;Nao consegui pagar"
              />
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Produtos relacionados (opcional)
              </label>
              <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
                {products.length === 0 ? (
                  <p className="text-sm text-gray-500 text-center py-2">Nenhum produto disponivel</p>
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
                                {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                              </button>
                            ) : <div className="w-5" />}
                            
                            {generalProduct && (
                              <input
                                type="checkbox"
                                checked={formData.productIds.includes(generalProduct.id)}
                                onChange={() => toggleProduct(generalProduct.id)}
                                className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                              />
                            )}
                            
                            <span className="font-medium text-gray-900 text-sm">{mainProduct}</span>
                            {specificProducts.length > 0 && <span className="text-xs text-gray-400">{specificProducts.length}</span>}
                            {selectedCount > 0 && (
                              <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{selectedCount}</span>
                            )}
                          </div>
                          
                          {isExpanded && specificProducts.length > 0 && (
                            <div className="bg-gray-50 border-t border-gray-100">
                              {specificProducts.map((product) => (
                                <label key={product.id} className="flex items-center gap-2 px-3 py-1.5 pl-10 hover:bg-gray-100 cursor-pointer">
                                  <input
                                    type="checkbox"
                                    checked={formData.productIds.includes(product.id)}
                                    onChange={() => toggleProduct(product.id)}
                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                  />
                                  <span className="text-sm text-gray-700">{product.subproduto}</span>
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

            <FormField
              type="select"
              label="Apresentado por"
              value={formData.presentedBy}
              onChange={(e) => setFormData({ ...formData, presentedBy: e.target.value as FormData["presentedBy"] })}
              options={[
                { value: "customer", label: "Cliente" },
                { value: "system", label: "Sistema" },
                { value: "both", label: "Ambos" },
              ]}
            />

            <FormField
              type="checkbox"
              label="Ativo"
              id="isActive"
              checked={formData.isActive}
              onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
            />

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={isMutating}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
              >
                {isMutating && <Loader2 className="w-4 h-4 animate-spin" />}
                <Check className="w-4 h-4" />
                {editingId ? "Atualizar" : "Criar"}
              </button>
              <button
                type="button"
                onClick={resetForm}
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
          { type: "select", value: selectedProduct, onChange: setSelectedProduct, placeholder: "Produto", options: distinctProducts.map(p => ({ value: p, label: p })) },
        ]}
        onClear={clearFilters}
      />

      {stats && (
        <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-b border-gray-100">
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-purple-700">{stats.totalProblems}</span> Problemas
          </span>
          <span className="text-sm text-gray-600">
            <span className="font-semibold text-green-600">{stats.activeProblems}</span> Ativos
          </span>
          <button
            onClick={() => generateEmbeddingsMutation.mutate()}
            disabled={generateEmbeddingsMutation.isPending || stats.withoutEmbedding === 0}
            className="text-sm text-gray-600 hover:text-purple-700 disabled:cursor-not-allowed disabled:opacity-50 flex items-center gap-1"
            title={stats.withoutEmbedding > 0 ? "Clique para gerar embeddings faltantes" : "Todos os embeddings estao gerados"}
          >
            {generateEmbeddingsMutation.isPending && <Loader2 className="w-3 h-3 animate-spin" />}
            <span className="font-semibold text-blue-600">{stats.withEmbedding}</span> Embeddings
            {stats.withoutEmbedding > 0 && (
              <span className="text-xs text-orange-500 ml-1">({stats.withoutEmbedding} pendente{stats.withoutEmbedding !== 1 ? "s" : ""})</span>
            )}
          </button>
        </div>
      )}

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
          <div className="text-center py-8 text-gray-500">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" />
            Carregando problemas...
          </div>
        ) : filteredProblems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
            <p>Nenhum problema {searchTerm || selectedProduct ? "encontrado" : "cadastrado"}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {hierarchy.map(node => renderProductNode(node, node.name))}
          </div>
        )}
      </div>
    </>
  );
}
