import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags, ChevronRight, ChevronDown, Plus, Loader2, Pencil, Trash2, X, Check } from "lucide-react";

interface ProductCatalogItem {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
  parentId: number | null;
}

interface KnowledgeSubject {
  id: number;
  productCatalogId: number;
  name: string;
  synonyms: string[];
  productName?: string | null;
}

interface KnowledgeIntent {
  id: number;
  subjectId: number;
  name: string;
  synonyms: string[];
  subjectName?: string | null;
}

interface ProductNode {
  id: number;
  name: string;
  fullPath: string;
  children: ProductNode[];
  subjects: KnowledgeSubject[];
}

function buildProductTree(products: ProductCatalogItem[], subjects: KnowledgeSubject[]): ProductNode[] {
  const productMap = new Map<string, ProductNode>();
  
  const sortedProducts = [...products].sort((a, b) => {
    const aDepth = [a.produto, a.subproduto, a.categoria1, a.categoria2].filter(Boolean).length;
    const bDepth = [b.produto, b.subproduto, b.categoria1, b.categoria2].filter(Boolean).length;
    return aDepth - bDepth;
  });
  
  for (const p of sortedProducts) {
    const node: ProductNode = {
      id: p.id,
      name: p.categoria2 || p.categoria1 || p.subproduto || p.produto,
      fullPath: p.fullName,
      children: [],
      subjects: subjects.filter(s => s.productCatalogId === p.id),
    };
    
    productMap.set(p.fullName, node);
    
    if (p.parentId) {
      const parent = [...productMap.values()].find(n => 
        products.find(prod => prod.id === p.parentId)?.fullName === n.fullPath
      );
      if (parent) {
        parent.children.push(node);
      }
    }
  }
  
  return [...productMap.values()].filter(node => {
    const product = products.find(p => p.fullName === node.fullPath);
    return product && !product.parentId;
  });
}

type FormState = 
  | { type: "none" }
  | { type: "addSubject"; productId: number }
  | { type: "editSubject"; subject: KnowledgeSubject }
  | { type: "addIntent"; subjectId: number }
  | { type: "editIntent"; intent: KnowledgeIntent };

export function SubjectsIntentsPage() {
  const queryClient = useQueryClient();
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>({ type: "none" });
  const [formName, setFormName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "subject" | "intent"; id: number } | null>(null);

  const { data: products = [], isLoading: productsLoading } = useQuery<ProductCatalogItem[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch products");
      return res.json();
    },
  });

  const { data: subjects = [], isLoading: subjectsLoading } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects", { withProduct: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/subjects?withProduct=true");
      if (!res.ok) throw new Error("Failed to fetch subjects");
      return res.json();
    },
  });

  const { data: intents = [], isLoading: intentsLoading } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents", { withSubject: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/intents?withSubject=true");
      if (!res.ok) throw new Error("Failed to fetch intents");
      return res.json();
    },
  });

  const createSubjectMutation = useMutation({
    mutationFn: async (data: { productCatalogId: number; name: string }) => {
      const res = await fetch("/api/knowledge/subjects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
      resetForm();
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/subjects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
      resetForm();
    },
  });

  const deleteSubjectMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/subjects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete subject");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      setDeleteConfirm(null);
    },
  });

  const createIntentMutation = useMutation({
    mutationFn: async (data: { subjectId: number; name: string }) => {
      const res = await fetch("/api/knowledge/intents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create intent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      resetForm();
    },
  });

  const updateIntentMutation = useMutation({
    mutationFn: async ({ id, name }: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/intents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error("Failed to update intent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      resetForm();
    },
  });

  const deleteIntentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/intents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete intent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      setDeleteConfirm(null);
    },
  });

  const isLoading = productsLoading || subjectsLoading || intentsLoading;
  const productTree = buildProductTree(products, subjects);

  const resetForm = () => {
    setFormState({ type: "none" });
    setFormName("");
  };

  const startAddSubject = (productId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormState({ type: "addSubject", productId });
    setFormName("");
    setExpandedProducts(prev => new Set(prev).add(productId));
  };

  const startEditSubject = (subject: KnowledgeSubject, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormState({ type: "editSubject", subject });
    setFormName(subject.name);
  };

  const startAddIntent = (subjectId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormState({ type: "addIntent", subjectId });
    setFormName("");
    setExpandedSubjects(prev => new Set(prev).add(subjectId));
  };

  const startEditIntent = (intent: KnowledgeIntent, e: React.MouseEvent) => {
    e.stopPropagation();
    setFormState({ type: "editIntent", intent });
    setFormName(intent.name);
  };

  const handleSubmit = () => {
    if (!formName.trim()) return;
    
    if (formState.type === "addSubject") {
      createSubjectMutation.mutate({ productCatalogId: formState.productId, name: formName.trim() });
    } else if (formState.type === "editSubject") {
      updateSubjectMutation.mutate({ id: formState.subject.id, name: formName.trim() });
    } else if (formState.type === "addIntent") {
      createIntentMutation.mutate({ subjectId: formState.subjectId, name: formName.trim() });
    } else if (formState.type === "editIntent") {
      updateIntentMutation.mutate({ id: formState.intent.id, name: formName.trim() });
    }
  };

  const handleDelete = (type: "subject" | "intent", id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleteConfirm({ type, id });
  };

  const confirmDelete = () => {
    if (!deleteConfirm) return;
    if (deleteConfirm.type === "subject") {
      deleteSubjectMutation.mutate(deleteConfirm.id);
    } else {
      deleteIntentMutation.mutate(deleteConfirm.id);
    }
  };

  const toggleProduct = (id: number) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSubject = (id: number) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const getIntentsForSubject = (subjectId: number) => {
    return intents.filter(i => i.subjectId === subjectId);
  };

  const isMutating = createSubjectMutation.isPending || updateSubjectMutation.isPending || 
    deleteSubjectMutation.isPending || createIntentMutation.isPending || 
    updateIntentMutation.isPending || deleteIntentMutation.isPending;

  const renderInlineForm = (paddingLeft: number, colorClass: string) => (
    <div 
      className={`flex items-center gap-2 py-1.5 px-2 ${colorClass} rounded`}
      style={{ paddingLeft: `${paddingLeft}px` }}
      onClick={(e) => e.stopPropagation()}
    >
      <span className="w-4" />
      <input
        type="text"
        value={formName}
        onChange={(e) => setFormName(e.target.value)}
        placeholder="Nome..."
        className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSubmit();
          if (e.key === "Escape") resetForm();
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!formName.trim() || isMutating}
        className="p-1 text-green-600 hover:bg-green-100 rounded disabled:opacity-50"
      >
        <Check className="w-4 h-4" />
      </button>
      <button
        onClick={resetForm}
        className="p-1 text-gray-500 hover:bg-gray-200 rounded"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );

  const renderProductNode = (node: ProductNode, depth: number = 0): React.ReactNode => {
    const isExpanded = expandedProducts.has(node.id);
    const hasChildren = node.children.length > 0 || node.subjects.length > 0;
    const paddingLeft = depth * 20;
    const showAddSubjectForm = formState.type === "addSubject" && formState.productId === node.id;

    return (
      <div key={node.id}>
        <div 
          className="group flex items-center gap-2 py-1.5 px-2 hover:bg-gray-50 rounded cursor-pointer"
          style={{ paddingLeft: `${paddingLeft}px` }}
          onClick={() => toggleProduct(node.id)}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />
          ) : (
            <span className="w-4" />
          )}
          <span className="font-medium text-gray-700">{node.name}</span>
          <span className="text-xs text-gray-400 ml-2">
            {node.subjects.length} assuntos
          </span>
          <button
            onClick={(e) => startAddSubject(node.id, e)}
            className="ml-auto p-1 opacity-0 group-hover:opacity-100 text-blue-600 hover:bg-blue-100 rounded transition-opacity"
            title="Adicionar assunto"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        
        {isExpanded && (
          <>
            {node.children.map(child => renderProductNode(child, depth + 1))}
            
            {showAddSubjectForm && renderInlineForm(paddingLeft + 20, "bg-blue-50")}
            
            {node.subjects.map(subject => {
              const subjectIntents = getIntentsForSubject(subject.id);
              const isSubjectExpanded = expandedSubjects.has(subject.id);
              const isEditingThisSubject = formState.type === "editSubject" && formState.subject.id === subject.id;
              const showAddIntentForm = formState.type === "addIntent" && formState.subjectId === subject.id;
              
              return (
                <div key={`subject-${subject.id}`}>
                  {isEditingThisSubject ? (
                    renderInlineForm(paddingLeft + 20, "bg-blue-50")
                  ) : (
                    <div 
                      className="group flex items-center gap-2 py-1.5 px-2 hover:bg-blue-50 rounded cursor-pointer"
                      style={{ paddingLeft: `${paddingLeft + 20}px` }}
                      onClick={() => toggleSubject(subject.id)}
                    >
                      {subjectIntents.length > 0 ? (
                        isSubjectExpanded ? <ChevronDown className="w-4 h-4 text-blue-400" /> : <ChevronRight className="w-4 h-4 text-blue-400" />
                      ) : (
                        <span className="w-4" />
                      )}
                      <Tags className="w-4 h-4 text-blue-500" />
                      <span className="text-blue-700">{subject.name}</span>
                      {subject.synonyms.length > 0 && (
                        <span className="text-xs text-gray-400">
                          ({subject.synonyms.length} sinônimos)
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-auto mr-2">
                        {subjectIntents.length} intenções
                      </span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => startAddIntent(subject.id, e)}
                          className="p-1 text-green-600 hover:bg-green-100 rounded"
                          title="Adicionar intenção"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => startEditSubject(subject, e)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                          title="Editar assunto"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => handleDelete("subject", subject.id, e)}
                          className="p-1 text-red-600 hover:bg-red-100 rounded"
                          title="Excluir assunto"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {isSubjectExpanded && (
                    <>
                      {showAddIntentForm && renderInlineForm(paddingLeft + 40, "bg-green-50")}
                      
                      {subjectIntents.map(intent => {
                        const isEditingThisIntent = formState.type === "editIntent" && formState.intent.id === intent.id;
                        
                        return isEditingThisIntent ? (
                          <div key={`intent-${intent.id}`}>
                            {renderInlineForm(paddingLeft + 40, "bg-green-50")}
                          </div>
                        ) : (
                          <div 
                            key={`intent-${intent.id}`}
                            className="group flex items-center gap-2 py-1.5 px-2 hover:bg-green-50 rounded"
                            style={{ paddingLeft: `${paddingLeft + 40}px` }}
                          >
                            <span className="w-4" />
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-green-700">{intent.name}</span>
                            {intent.synonyms.length > 0 && (
                              <span className="text-xs text-gray-400">
                                ({intent.synonyms.length} sinônimos)
                              </span>
                            )}
                            <div className="flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity">
                              <button
                                onClick={(e) => startEditIntent(intent, e)}
                                className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                                title="Editar intenção"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={(e) => handleDelete("intent", intent.id, e)}
                                className="p-1 text-red-600 hover:bg-red-100 rounded"
                                title="Excluir intenção"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          Gerencie os assuntos e intenções associados aos produtos.
        </p>
      </div>

      {productTree.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Cadastre produtos em Configurações &gt; Cadastro &gt; Produtos</p>
        </div>
      ) : (
        <div className="border rounded-lg p-3 max-h-[500px] overflow-y-auto">
          {productTree.map(node => renderProductNode(node))}
        </div>
      )}

      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              Confirmar exclusão
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {deleteConfirm.type === "subject" 
                ? "Tem certeza que deseja excluir este assunto? Todas as intenções associadas também serão excluídas."
                : "Tem certeza que deseja excluir esta intenção?"
              }
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={isMutating}
                className="px-3 py-1.5 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
              >
                {isMutating ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
