import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, AlertCircle, ChevronRight, ChevronDown, Minus, Loader2 } from "lucide-react";
import { FilterBar } from "../../../shared/components/ui/FilterBar";
import { useCrudMutations, useCrudFormState } from "../../../shared/hooks";
import { apiRequest } from "../../../lib/queryClient";
import { 
  ObjectiveProblemForm, 
  emptyObjectiveProblemForm, 
  transformObjectiveProblemFormData,
  type ObjectiveProblemFormData 
} from "../components/ObjectiveProblemForm";
import type { ProductCatalogItem, ObjectiveProblem, ObjectiveProblemStats } from "../../../types";

interface ProductHierarchy {
  name: string;
  productId?: number;
  problems: ObjectiveProblem[];
  children: ProductHierarchy[];
}

export function ObjectiveProblemsPage() {
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");

  const {
    showForm,
    editingId,
    formData,
    setFormData,
    openCreateForm,
    openEditForm,
    resetForm,
    isEditing,
  } = useCrudFormState<ObjectiveProblemFormData>({
    emptyForm: emptyObjectiveProblemForm,
  });

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const { data: problems = [], isLoading } = useQuery<ObjectiveProblem[]>({
    queryKey: ["/api/knowledge/objective-problems"],
  });

  const { data: products = [] } = useQuery<ProductCatalogItem[]>({
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

  const { handleCreate, handleUpdate, handleDelete, isMutating, isDeleting } = useCrudMutations<ObjectiveProblemFormData, ObjectiveProblemFormData>({
    baseUrl: "/api/knowledge/objective-problems",
    queryKeys: ["/api/knowledge/objective-problems", "/api/knowledge/objective-problems/stats"],
    transformCreateData: transformObjectiveProblemFormData,
    transformUpdateData: transformObjectiveProblemFormData,
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
    openEditForm(problem.id, {
      name: problem.name,
      description: problem.description,
      synonyms: problem.synonyms.join("\n"),
      examples: problem.examples.join("\n"),
      presentedBy: problem.presentedBy,
      isActive: problem.isActive,
      productIds: problem.productIds || [],
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingId) {
      handleUpdate(editingId, formData);
    } else {
      handleCreate(formData);
    }
  };

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
      <ObjectiveProblemForm
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleSubmit}
        onCancel={resetForm}
        isEditing={isEditing}
        isMutating={isMutating}
      />
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
            onClick={openCreateForm}
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
