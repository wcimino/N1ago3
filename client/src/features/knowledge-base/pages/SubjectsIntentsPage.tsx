import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Tags, ChevronRight, ChevronDown, Plus, Minus, Loader2, Pencil, Trash2, X, Check, Tag, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import type { ProductCatalogItem, KnowledgeSubject, KnowledgeIntent } from "../../../types";
import { buildProductTreeWithSubjects, type ProductNodeWithSubjects } from "../../../lib/productHierarchy";

type FormState = 
  | { type: "none" }
  | { type: "addSubject"; productId: number }
  | { type: "editSubject"; subject: KnowledgeSubject }
  | { type: "addIntent"; subjectId: number }
  | { type: "editIntent"; intent: KnowledgeIntent };

type SynonymsEditState = 
  | { type: "none" }
  | { type: "subject"; subject: KnowledgeSubject }
  | { type: "intent"; intent: KnowledgeIntent };

export function SubjectsIntentsPage() {
  const queryClient = useQueryClient();
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<number>>(new Set());
  const [formState, setFormState] = useState<FormState>({ type: "none" });
  const [formName, setFormName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "subject" | "intent"; id: number } | null>(null);
  const [synonymsEdit, setSynonymsEdit] = useState<SynonymsEditState>({ type: "none" });
  const [newSynonym, setNewSynonym] = useState("");

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
    mutationFn: async ({ id, name, synonyms }: { id: number; name?: string; synonyms?: string[] }) => {
      const res = await fetch(`/api/knowledge/subjects/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, synonyms }),
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
    mutationFn: async ({ id, name, synonyms }: { id: number; name?: string; synonyms?: string[] }) => {
      const res = await fetch(`/api/knowledge/intents/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, synonyms }),
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
  const productTree = buildProductTreeWithSubjects(products, subjects);

  const allProductIds = useMemo(() => {
    const ids = new Set<number>();
    for (const node of productTree) {
      ids.add(node.id);
      for (const child of node.children) {
        ids.add(child.id);
      }
    }
    return ids;
  }, [productTree]);

  const allSubjectIds = useMemo(() => {
    return new Set(subjects.map(s => s.id));
  }, [subjects]);

  const isAllExpanded = expandedProducts.size >= allProductIds.size && expandedSubjects.size >= allSubjectIds.size;

  const expandAll = () => {
    setExpandedProducts(new Set(allProductIds));
    setExpandedSubjects(new Set(allSubjectIds));
  };

  const collapseAll = () => {
    setExpandedProducts(new Set());
    setExpandedSubjects(new Set());
  };

  const totalSynonyms = useMemo(() => {
    let count = 0;
    for (const s of subjects) {
      count += s.synonyms?.length || 0;
    }
    for (const i of intents) {
      count += i.synonyms?.length || 0;
    }
    return count;
  }, [subjects, intents]);

  const getNodeStats = (node: ProductNodeWithSubjects) => {
    let subproductCount = node.children.length;
    let subjectCount = node.subjects.length;
    let intentCount = 0;
    let synonymCount = 0;
    
    for (const s of node.subjects) {
      synonymCount += s.synonyms?.length || 0;
      const subjectIntents = intents.filter(i => i.subjectId === s.id);
      intentCount += subjectIntents.length;
      for (const i of subjectIntents) {
        synonymCount += i.synonyms?.length || 0;
      }
    }
    
    for (const child of node.children) {
      const childStats = getNodeStats(child);
      subjectCount += childStats.subjectCount;
      intentCount += childStats.intentCount;
      synonymCount += childStats.synonymCount;
    }
    
    return { subproductCount, subjectCount, intentCount, synonymCount };
  };

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

  const openSynonymsSubject = (subject: KnowledgeSubject, e: React.MouseEvent) => {
    e.stopPropagation();
    setSynonymsEdit({ type: "subject", subject });
    setNewSynonym("");
  };

  const openSynonymsIntent = (intent: KnowledgeIntent, e: React.MouseEvent) => {
    e.stopPropagation();
    setSynonymsEdit({ type: "intent", intent });
    setNewSynonym("");
  };

  const closeSynonymsPanel = () => {
    setSynonymsEdit({ type: "none" });
    setNewSynonym("");
  };

  const addSynonym = () => {
    const trimmed = newSynonym.trim();
    if (!trimmed) return;
    
    if (synonymsEdit.type === "subject") {
      const currentSynonyms = synonymsEdit.subject.synonyms || [];
      if (currentSynonyms.includes(trimmed)) return;
      const newSynonyms = [...currentSynonyms, trimmed];
      updateSubjectMutation.mutate(
        { id: synonymsEdit.subject.id, synonyms: newSynonyms },
        { onSuccess: () => {
          setNewSynonym("");
          setSynonymsEdit({ type: "subject", subject: { ...synonymsEdit.subject, synonyms: newSynonyms } });
        }}
      );
    } else if (synonymsEdit.type === "intent") {
      const currentSynonyms = synonymsEdit.intent.synonyms || [];
      if (currentSynonyms.includes(trimmed)) return;
      const newSynonyms = [...currentSynonyms, trimmed];
      updateIntentMutation.mutate(
        { id: synonymsEdit.intent.id, synonyms: newSynonyms },
        { onSuccess: () => {
          setNewSynonym("");
          setSynonymsEdit({ type: "intent", intent: { ...synonymsEdit.intent, synonyms: newSynonyms } });
        }}
      );
    }
  };

  const removeSynonym = (synonym: string) => {
    if (synonymsEdit.type === "subject") {
      const currentSynonyms = synonymsEdit.subject.synonyms || [];
      const newSynonyms = currentSynonyms.filter(s => s !== synonym);
      updateSubjectMutation.mutate(
        { id: synonymsEdit.subject.id, synonyms: newSynonyms },
        { onSuccess: () => setSynonymsEdit({ type: "subject", subject: { ...synonymsEdit.subject, synonyms: newSynonyms } }) }
      );
    } else if (synonymsEdit.type === "intent") {
      const currentSynonyms = synonymsEdit.intent.synonyms || [];
      const newSynonyms = currentSynonyms.filter(s => s !== synonym);
      updateIntentMutation.mutate(
        { id: synonymsEdit.intent.id, synonyms: newSynonyms },
        { onSuccess: () => setSynonymsEdit({ type: "intent", intent: { ...synonymsEdit.intent, synonyms: newSynonyms } }) }
      );
    }
  };

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

  const renderProductNodeWithSubjects = (node: ProductNodeWithSubjects, depth: number = 0, parentName?: string): React.ReactNode => {
    const isExpanded = expandedProducts.has(node.id);
    const hasChildren = node.children.length > 0 || node.subjects.length > 0;
    const showAddSubjectForm = formState.type === "addSubject" && formState.productId === node.id;
    const stats = getNodeStats(node);
    const isSubproduct = depth > 0;
    const displayName = isSubproduct && parentName ? `${parentName} > ${node.name}` : node.name;

    const statsItems = [];
    if (stats.subproductCount > 0) statsItems.push(`${stats.subproductCount} subproduto${stats.subproductCount > 1 ? 's' : ''}`);
    if (stats.subjectCount > 0) statsItems.push(`${stats.subjectCount} assunto${stats.subjectCount > 1 ? 's' : ''}`);
    if (stats.intentCount > 0) statsItems.push(`${stats.intentCount} intenç${stats.intentCount > 1 ? 'ões' : 'ão'}`);
    if (stats.synonymCount > 0) statsItems.push(`${stats.synonymCount} sinônimo${stats.synonymCount > 1 ? 's' : ''}`);

    return (
      <div key={node.id} className="mb-2">
        <div className="bg-white border border-gray-200 shadow-sm hover:shadow-md rounded-lg p-3 sm:p-4 group">
          <div 
            className={`flex items-start gap-2 sm:gap-3 ${hasChildren ? "cursor-pointer" : ""}`}
            onClick={() => hasChildren && toggleProduct(node.id)}
          >
            {hasChildren ? (
              <button 
                className="p-0.5 rounded hover:bg-gray-200 mt-0.5 shrink-0"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProduct(node.id);
                }}
              >
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
              </button>
            ) : (
              <div className="w-5 shrink-0" />
            )}

            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                <span className={`font-medium text-gray-900 break-words ${isSubproduct ? "text-sm" : "text-base"}`}>
                  {displayName}
                </span>
                {statsItems.map((item, idx) => (
                  <span key={idx} className="hidden md:inline-flex items-center whitespace-nowrap text-xs text-gray-500">
                    {item}
                  </span>
                ))}
              </div>
              <div className="flex md:hidden flex-wrap items-center gap-2 mt-1.5 text-xs text-gray-500">
                {statsItems.map((item, idx) => (
                  <span key={idx} className="whitespace-nowrap">{item}</span>
                ))}
              </div>
            </div>

            <button
              onClick={(e) => startAddSubject(node.id, e)}
              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0"
              title="Adicionar assunto"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {isExpanded && (
            <div className={node.subjects.length > 0 || showAddSubjectForm ? "mt-3 pt-3 border-t border-gray-100" : ""}>
              {showAddSubjectForm && renderInlineForm(0, "bg-blue-50")}
              
              {node.subjects.map(subject => {
                const subjectIntents = getIntentsForSubject(subject.id);
                const isSubjectExpanded = expandedSubjects.has(subject.id);
                const isEditingThisSubject = formState.type === "editSubject" && formState.subject.id === subject.id;
                const showAddIntentForm = formState.type === "addIntent" && formState.subjectId === subject.id;
                const hasIntents = subjectIntents.length > 0;
                
                return (
                  <div key={`subject-${subject.id}`}>
                    {isEditingThisSubject ? (
                      renderInlineForm(0, "bg-blue-50")
                    ) : (
                      <div 
                        className={`group flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded ${hasIntents ? "cursor-pointer" : ""}`}
                        onClick={() => hasIntents && toggleSubject(subject.id)}
                      >
                        {hasIntents ? (
                          <button 
                            className="p-0.5 rounded hover:bg-gray-200 shrink-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSubject(subject.id);
                            }}
                          >
                            {isSubjectExpanded ? (
                              <Minus className="w-4 h-4 text-gray-500" />
                            ) : (
                              <Plus className="w-4 h-4 text-gray-500" />
                            )}
                          </button>
                        ) : (
                          <div className="w-5 shrink-0" />
                        )}
                        <span className="text-sm font-medium text-gray-900">{subject.name}</span>
                        <span className="text-xs text-gray-500">
                          {subjectIntents.length} {subjectIntents.length === 1 ? 'intenção' : 'intenções'}
                        </span>
                        {subject.synonyms.length > 0 && (
                          <span className="text-xs text-purple-500">
                            ({subject.synonyms.length} sinônimos)
                          </span>
                        )}
                        <div className="flex items-center gap-1 ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => openSynonymsSubject(subject, e)}
                            className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                            title="Gerenciar sinônimos"
                          >
                            <Tag className="w-3.5 h-3.5" />
                          </button>
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
                      <div className="ml-5">
                        {showAddIntentForm && renderInlineForm(0, "bg-green-50")}
                        
                        {subjectIntents.map(intent => {
                          const isEditingThisIntent = formState.type === "editIntent" && formState.intent.id === intent.id;
                          
                          return isEditingThisIntent ? (
                            <div key={`intent-${intent.id}`}>
                              {renderInlineForm(0, "bg-green-50")}
                            </div>
                          ) : (
                            <div 
                              key={`intent-${intent.id}`}
                              className="group flex items-center gap-2 py-2 px-2 hover:bg-gray-50 rounded"
                            >
                              <div className="w-5 shrink-0" />
                              <span className="text-sm text-gray-700">{intent.name}</span>
                              {intent.synonyms.length > 0 && (
                                <span className="text-xs text-purple-500">
                                  ({intent.synonyms.length} sinônimos)
                                </span>
                              )}
                              <div className="flex items-center gap-1 ml-auto sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={(e) => openSynonymsIntent(intent, e)}
                                  className="p-1 text-purple-600 hover:bg-purple-100 rounded"
                                  title="Gerenciar sinônimos"
                                >
                                  <Tag className="w-3.5 h-3.5" />
                                </button>
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
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        {isExpanded && node.children.length > 0 && (
          <div className="mt-2 ml-4">
            {node.children.map(child => renderProductNodeWithSubjects(child, depth + 1, node.name))}
          </div>
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
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-end mb-3">
        
        {productTree.length > 0 && (
          <button
            onClick={isAllExpanded ? collapseAll : expandAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {isAllExpanded ? (
              <>
                <ChevronsDownUp className="w-4 h-4" />
                Recolher tudo
              </>
            ) : (
              <>
                <ChevronsUpDown className="w-4 h-4" />
                Expandir tudo
              </>
            )}
          </button>
        )}
      </div>

      {productTree.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Tags className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p>Nenhum produto cadastrado</p>
          <p className="text-sm mt-1">Cadastre produtos em Configurações &gt; Cadastro &gt; Produtos</p>
        </div>
      ) : (
        <div className="border rounded-lg p-3 flex-1 overflow-y-auto min-h-0">
          {productTree.map(node => renderProductNodeWithSubjects(node))}
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

      {synonymsEdit.type !== "none" && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                Sinônimos de "{synonymsEdit.type === "subject" ? synonymsEdit.subject.name : synonymsEdit.intent.name}"
              </h3>
              <button
                onClick={closeSynonymsPanel}
                className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-gray-500 mb-4">
              Sinônimos ajudam a IA a encontrar este {synonymsEdit.type === "subject" ? "assunto" : "intenção"} usando termos alternativos.
            </p>

            <div className="flex flex-wrap gap-2 mb-4 min-h-[40px] p-2 border rounded bg-gray-50">
              {(synonymsEdit.type === "subject" ? synonymsEdit.subject.synonyms : synonymsEdit.intent.synonyms).length === 0 ? (
                <span className="text-sm text-gray-400 italic">Nenhum sinônimo cadastrado</span>
              ) : (
                (synonymsEdit.type === "subject" ? synonymsEdit.subject.synonyms : synonymsEdit.intent.synonyms).map((synonym, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 text-sm rounded-full"
                  >
                    {synonym}
                    <button
                      onClick={() => removeSynonym(synonym)}
                      disabled={isMutating}
                      className="p-0.5 hover:bg-purple-200 rounded-full disabled:opacity-50"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSynonym}
                onChange={(e) => setNewSynonym(e.target.value)}
                placeholder="Novo sinônimo..."
                className="flex-1 px-3 py-2 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-purple-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter") addSynonym();
                }}
              />
              <button
                onClick={addSynonym}
                disabled={!newSynonym.trim() || isMutating}
                className="px-3 py-2 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1"
              >
                {isMutating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
