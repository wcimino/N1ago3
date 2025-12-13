import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, BookOpen, X, Lightbulb, BarChart3, Cloud, Database, ChevronsUpDown, ChevronsDownUp, AlertCircle, Play, Puzzle, Layers, GitBranch } from "lucide-react";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { HierarchyNodeItem } from "../components/HierarchyNodeItem";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { ZendeskArticlesPage } from "./ZendeskArticlesPage";
import { ObjectiveProblemsPage } from "./ObjectiveProblemsPage";
import { ActionsPage } from "./ActionsPage";
import { SolutionsPage } from "./SolutionsPage";
import { RootCausesPage } from "./RootCausesPage";
import { PageHeader, FilterBar, StatsBar, InputModal } from "../../../shared/components/ui";
import { ConfirmModal } from "../../../shared/components/ui/ConfirmModal";
import { useKnowledgeBase } from "../hooks/useKnowledgeBase";

const mainTabs = [
  { id: "articles", label: "Artigos", icon: <BookOpen className="w-4 h-4" /> },
  { id: "suggestions", label: "Sugestões", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "processing", label: "Processamento", icon: <BarChart3 className="w-4 h-4" /> },
];

const problemSolutionTabs = [
  { id: "problems", label: "Problemas", icon: <AlertCircle className="w-4 h-4" /> },
  { id: "root-causes", label: "Causas-raízes", icon: <GitBranch className="w-4 h-4" /> },
  { id: "actions", label: "Ações", icon: <Play className="w-4 h-4" /> },
  { id: "solutions", label: "Soluções", icon: <Puzzle className="w-4 h-4" /> },
];

const baseTabs = [
  { id: "problems-solutions", label: "Problemas e Soluções", icon: <Layers className="w-4 h-4" /> },
  { id: "internal", label: "Base interna de Artigos", icon: <Database className="w-4 h-4" /> },
  { id: "zendesk", label: "Base Zendesk", icon: <Cloud className="w-4 h-4" /> },
];

interface PrefilledArticleData {
  productStandard: string;
  subproductStandard: string | null;
  subjectId: number;
  intentId: number;
  subjectName: string;
  intentName: string;
}

interface InputModalState {
  isOpen: boolean;
  type: "subject" | "intent" | null;
  targetId: number | null;
  mode: "create" | "edit";
  currentName?: string;
}

interface ConfirmModalState {
  isOpen: boolean;
  type: "subject" | "intent" | null;
  id: number | null;
  name: string;
  hasArticles: boolean;
}

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeBaseTab, setActiveBaseTab] = useState("internal");
  const [prefilledData, setPrefilledData] = useState<PrefilledArticleData | null>(null);
  
  const handleBaseTabChange = (tabId: string) => {
    setActiveBaseTab(tabId);
    if (tabId === "problems-solutions") {
      setActiveTab("problems");
    } else if (tabId === "internal") {
      setActiveTab("articles");
    }
  };
  
  const handleSecondaryTabChange = (tabId: string) => {
    setActiveTab(tabId);
  };
  const [inputModal, setInputModal] = useState<InputModalState>({
    isOpen: false,
    type: null,
    targetId: null,
    mode: "create",
  });
  const [confirmModal, setConfirmModal] = useState<ConfirmModalState>({
    isOpen: false,
    type: null,
    id: null,
    name: "",
    hasArticles: false,
  });
  const queryClient = useQueryClient();
  
  const {
    isLoading,
    filters,
    hierarchy,
    showForm,
    setShowForm,
    editingArticle,
    searchTerm,
    setSearchTerm,
    selectedProduct,
    handleProductChange,
    selectedSubjectId,
    handleSubjectChange,
    selectedIntentId,
    setSelectedIntentId,
    filteredSubjects,
    filteredIntents,
    expandedPaths,
    createMutation,
    updateMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancel,
    togglePath,
    expandAllPaths,
    collapseAllPaths,
    subjects,
    intents,
    catalogStats,
    intentViewCountMap,
    generateEmbeddingsMutation,
    embeddingStats,
  } = useKnowledgeBase(activeTab);

  const allPathsCount = useMemo(() => {
    const count = (nodes: typeof hierarchy): number => 
      nodes.reduce((acc, n) => acc + 1 + count(n.children), 0);
    return count(hierarchy);
  }, [hierarchy]);

  const isAllArticlesExpanded = expandedPaths.size >= allPathsCount && allPathsCount > 0;

  const handleAddArticle = (subjectId?: number, intentId?: number, fullPath?: string) => {
    if (!intentId || !subjectId || !fullPath) return;
    
    const subject = subjects.find(s => s.id === subjectId);
    const intent = intents.find(i => i.id === intentId);
    
    if (subject && intent) {
      // Parse fullPath to extract product and subproduct
      // Format: "Produto > Subproduto > Assunto > Intenção" (4 parts) or "Produto > Assunto > Intenção" (3 parts)
      const parts = fullPath.split(" > ");
      const productStandard = parts[0] || "";
      const subproductStandard = parts.length === 4 ? parts[1] : null;
      
      setPrefilledData({
        productStandard,
        subproductStandard,
        subjectId,
        intentId,
        subjectName: subject.name,
        intentName: intent.name,
      });
      setShowForm(true);
    }
  };

  const handleCancelForm = () => {
    handleCancel();
    setPrefilledData(null);
  };

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
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const deleteIntentMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge/intents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete intent");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/articles"] });
    },
  });

  const updateIntentMutation = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/intents/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) throw new Error("Failed to update intent");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/intents"] });
    },
  });

  const updateSubjectMutation = useMutation({
    mutationFn: async (data: { id: number; name: string }) => {
      const res = await fetch(`/api/knowledge/subjects/${data.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: data.name }),
      });
      if (!res.ok) throw new Error("Failed to update subject");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge/subjects"] });
    },
  });

  const handleAddSubject = (productId: number) => {
    setInputModal({ isOpen: true, type: "subject", targetId: productId, mode: "create" });
  };

  const handleAddIntent = (subjectId: number) => {
    setInputModal({ isOpen: true, type: "intent", targetId: subjectId, mode: "create" });
  };

  const handleEditIntent = (intentId: number, intentName: string) => {
    setInputModal({ isOpen: true, type: "intent", targetId: intentId, mode: "edit", currentName: intentName });
  };

  const handleEditSubject = (subjectId: number, subjectName: string) => {
    setInputModal({ isOpen: true, type: "subject", targetId: subjectId, mode: "edit", currentName: subjectName });
  };

  const handleInputModalConfirm = (name: string) => {
    if (inputModal.mode === "edit" && inputModal.type === "subject" && inputModal.targetId) {
      updateSubjectMutation.mutate({ id: inputModal.targetId, name });
    } else if (inputModal.mode === "edit" && inputModal.type === "intent" && inputModal.targetId) {
      updateIntentMutation.mutate({ id: inputModal.targetId, name });
    } else if (inputModal.type === "subject" && inputModal.targetId) {
      createSubjectMutation.mutate({ productCatalogId: inputModal.targetId, name });
    } else if (inputModal.type === "intent" && inputModal.targetId) {
      createIntentMutation.mutate({ subjectId: inputModal.targetId, name });
    }
  };

  const handleInputModalClose = () => {
    setInputModal({ isOpen: false, type: null, targetId: null, mode: "create", currentName: undefined });
  };

  const handleDeleteSubject = (subjectId: number, subjectName: string, hasArticles: boolean) => {
    setConfirmModal({ isOpen: true, type: "subject", id: subjectId, name: subjectName, hasArticles });
  };

  const handleDeleteIntent = (intentId: number, intentName: string, hasArticles: boolean) => {
    setConfirmModal({ isOpen: true, type: "intent", id: intentId, name: intentName, hasArticles });
  };

  const handleConfirmDelete = () => {
    if (confirmModal.type === "subject" && confirmModal.id) {
      deleteSubjectMutation.mutate(confirmModal.id);
    } else if (confirmModal.type === "intent" && confirmModal.id) {
      deleteIntentMutation.mutate(confirmModal.id);
    }
  };

  const handleConfirmModalClose = () => {
    setConfirmModal({ isOpen: false, type: null, id: null, name: "", hasArticles: false });
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <PageHeader
        title="Base de Conhecimento"
        icon={<BookOpen className="w-5 h-5" />}
        primaryTabs={baseTabs}
        primaryActiveTab={activeBaseTab}
        onPrimaryTabChange={handleBaseTabChange}
        secondaryTabs={activeBaseTab === "problems-solutions" ? problemSolutionTabs : mainTabs}
        secondaryActiveTab={activeTab}
        onSecondaryTabChange={handleSecondaryTabChange}
        showSecondaryTabs={activeBaseTab !== "zendesk"}
      />

      {activeBaseTab === "zendesk" ? (
        <div className="p-4">
          <ZendeskArticlesPage />
        </div>
      ) : (
        <>

          {activeTab === "processing" ? (
            <div className="p-4">
              <LearningAttemptsPage />
            </div>
          ) : activeTab === "suggestions" ? (
            <div className="p-4">
              <SuggestionsPage />
            </div>
          ) : activeTab === "problems" ? (
            <div className="p-4">
              <ObjectiveProblemsPage />
            </div>
          ) : activeTab === "root-causes" ? (
            <div className="p-4">
              <RootCausesPage />
            </div>
          ) : activeTab === "actions" ? (
            <div className="p-4">
              <ActionsPage />
            </div>
          ) : activeTab === "solutions" ? (
            <div className="p-4">
              <SolutionsPage />
            </div>
          ) : showForm ? (
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-medium">
                  {editingArticle ? "Editar Artigo" : "Novo Artigo"}
                </h3>
                <button
                  onClick={handleCancelForm}
                  className="p-2 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <KnowledgeBaseForm
                initialData={editingArticle}
                prefilledData={prefilledData}
                onSubmit={handleSubmit}
                onCancel={handleCancelForm}
                isLoading={createMutation.isPending || updateMutation.isPending}
              />
            </div>
          ) : (
            <>
              <FilterBar
                filters={[
                  { type: "search", value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar..." },
                  { type: "select", value: selectedProduct, onChange: handleProductChange, placeholder: "Produto", options: filters?.products || [] },
                  { type: "select", value: selectedSubjectId?.toString() || "", onChange: (v) => handleSubjectChange(v ? parseInt(v) : null), placeholder: "Assunto", options: filteredSubjects.map(s => ({ value: s.id.toString(), label: s.name })), disabled: !selectedProduct || filteredSubjects.length === 0 },
                  { type: "select", value: selectedIntentId?.toString() || "", onChange: (v) => setSelectedIntentId(v ? parseInt(v) : null), placeholder: "Intenção", options: filteredIntents.map(i => ({ value: i.id.toString(), label: i.name })), disabled: !selectedSubjectId || filteredIntents.length === 0 },
                ]}
              />

              <div className="p-4 h-[calc(100vh-250px)] flex flex-col">
                {isLoading ? (
                  <div className="text-center py-8 text-gray-500">Carregando...</div>
                ) : hierarchy.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Nenhum produto cadastrado</p>
                    <p className="text-sm mt-1">Cadastre produtos em Configurações &gt; Cadastro &gt; Produtos</p>
                  </div>
                ) : (
                  <>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-3">
                      <StatsBar
                        stats={[
                          { value: catalogStats.productsCount, label: "Produtos" },
                          { value: catalogStats.subproductsCount, label: "Subprodutos" },
                          { value: catalogStats.subjectsCount, label: "Assuntos" },
                          { value: catalogStats.intentsCount, label: "Intenções" },
                          { value: catalogStats.articlesCount, label: "Artigos" },
                          { 
                            value: catalogStats.embeddingsCount, 
                            label: "Embeddings", 
                            onClick: () => generateEmbeddingsMutation.mutate(),
                            isLoading: generateEmbeddingsMutation.isPending,
                            disabled: !embeddingStats || (embeddingStats.withoutEmbedding === 0 && embeddingStats.outdated === 0),
                            highlight: embeddingStats && (embeddingStats.withoutEmbedding > 0 || embeddingStats.outdated > 0),
                          },
                        ]}
                      />
                      <button
                        onClick={isAllArticlesExpanded ? collapseAllPaths : expandAllPaths}
                        className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors shrink-0"
                      >
                        {isAllArticlesExpanded ? (
                          <>
                            <ChevronsDownUp className="w-4 h-4" />
                            <span className="hidden sm:inline">Recolher tudo</span>
                          </>
                        ) : (
                          <>
                            <ChevronsUpDown className="w-4 h-4" />
                            <span className="hidden sm:inline">Expandir tudo</span>
                          </>
                        )}
                      </button>
                    </div>
                    <div className="space-y-1 border rounded-lg p-3 flex-1 overflow-y-auto min-h-0">
                      {hierarchy.map((node) => (
                        <HierarchyNodeItem
                          key={node.fullPath}
                          node={node}
                          depth={0}
                          expandedPaths={expandedPaths}
                          onToggle={togglePath}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onAddArticle={handleAddArticle}
                          onAddSubject={handleAddSubject}
                          onAddIntent={handleAddIntent}
                          onEditIntent={handleEditIntent}
                          onEditSubject={handleEditSubject}
                          onDeleteSubject={handleDeleteSubject}
                          onDeleteIntent={handleDeleteIntent}
                          intentViewCountMap={intentViewCountMap}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </>
      )}

      <InputModal
        isOpen={inputModal.isOpen}
        onClose={handleInputModalClose}
        onConfirm={handleInputModalConfirm}
        title={
          inputModal.mode === "edit" 
            ? "Editar Intenção" 
            : inputModal.type === "subject" 
              ? "Novo Assunto" 
              : "Nova Intenção"
        }
        placeholder={inputModal.type === "subject" ? "Nome do assunto..." : "Nome da intenção..."}
        confirmLabel={inputModal.mode === "edit" ? "Salvar" : "Criar"}
        initialValue={inputModal.currentName}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={handleConfirmModalClose}
        onConfirm={handleConfirmDelete}
        title={confirmModal.type === "subject" ? "Excluir Assunto" : "Excluir Intenção"}
        message={
          confirmModal.type === "subject"
            ? `Tem certeza que deseja excluir o assunto "${confirmModal.name}"?${confirmModal.hasArticles ? "\n\nTodas as intenções e artigos associados também serão excluídos." : ""}`
            : `Tem certeza que deseja excluir a intenção:\n\n"${confirmModal.name}"${confirmModal.hasArticles ? "\n\nO artigo associado também será excluído." : ""}`
        }
        confirmLabel="Excluir"
        variant="danger"
      />
    </div>
  );
}
