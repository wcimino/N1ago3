import { useState } from "react";
import { BookOpen, Lightbulb, BarChart3, Cloud, Database, AlertCircle, Play, Puzzle, Layers, GitBranch } from "lucide-react";
import { ArticleFormSection, ArticlesHierarchyView, type PrefilledArticleData } from "../components";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { ZendeskArticlesPage } from "./ZendeskArticlesPage";
import { ObjectiveProblemsPage } from "./ObjectiveProblemsPage";
import { ActionsPage } from "./ActionsPage";
import { SolutionsPage } from "./SolutionsPage";
import { RootCausesPage } from "./RootCausesPage";
import { PageHeader, InputModal } from "../../../shared/components/ui";
import { ConfirmModal } from "../../../shared/components/ui/ConfirmModal";
import { useKnowledgeBase, useSubjectIntentMutations, type InputModalState, type ConfirmModalState } from "../hooks";

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

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeBaseTab, setActiveBaseTab] = useState("internal");
  const [prefilledData, setPrefilledData] = useState<PrefilledArticleData | null>(null);
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
    patchMutation,
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

  const {
    handleInputModalConfirm: handleMutationConfirm,
    handleConfirmDelete: handleMutationDelete,
  } = useSubjectIntentMutations();

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

  const handleAddArticle = (subjectId?: number, intentId?: number, fullPath?: string, productCatalogId?: number) => {
    if (!intentId || !subjectId) return;
    
    const subject = subjects.find(s => s.id === subjectId);
    const intent = intents.find(i => i.id === intentId);
    
    if (subject && intent && productCatalogId) {
      const parts = fullPath?.split(" > ") || [];
      const productName = parts[0] || "";
      
      setPrefilledData({
        productId: productCatalogId,
        subjectId,
        intentId,
        subjectName: subject.name,
        intentName: intent.name,
        productName,
      });
      setShowForm(true);
    }
  };

  const handleCancelForm = () => {
    handleCancel();
    setPrefilledData(null);
  };

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
    handleMutationConfirm(inputModal, name);
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
    handleMutationDelete(confirmModal);
  };

  const handleConfirmModalClose = () => {
    setConfirmModal({ isOpen: false, type: null, id: null, name: "", hasArticles: false });
  };

  const handleToggleVisibility = (articleId: number, currentValue: boolean) => {
    patchMutation.mutate({ id: articleId, visibleInSearch: !currentValue });
  };

  const handleToggleAutoReply = (articleId: number, currentValue: boolean) => {
    patchMutation.mutate({ id: articleId, availableForAutoReply: !currentValue });
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
            <ArticleFormSection
              editingArticle={editingArticle}
              prefilledData={prefilledData}
              onSubmit={handleSubmit}
              onCancel={handleCancelForm}
              isLoading={createMutation.isPending || updateMutation.isPending}
            />
          ) : (
            <ArticlesHierarchyView
              isLoading={isLoading}
              hierarchy={hierarchy}
              expandedPaths={expandedPaths}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              selectedProduct={selectedProduct}
              handleProductChange={handleProductChange}
              selectedSubjectId={selectedSubjectId}
              handleSubjectChange={handleSubjectChange}
              selectedIntentId={selectedIntentId}
              setSelectedIntentId={setSelectedIntentId}
              filteredSubjects={filteredSubjects}
              filteredIntents={filteredIntents}
              productOptions={(filters?.products || []).map(id => id.toString())}
              togglePath={togglePath}
              expandAllPaths={expandAllPaths}
              collapseAllPaths={collapseAllPaths}
              catalogStats={catalogStats}
              embeddingStats={embeddingStats}
              generateEmbeddingsMutation={generateEmbeddingsMutation}
              intentViewCountMap={intentViewCountMap}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onAddArticle={handleAddArticle}
              onAddSubject={handleAddSubject}
              onAddIntent={handleAddIntent}
              onEditIntent={handleEditIntent}
              onEditSubject={handleEditSubject}
              onDeleteSubject={handleDeleteSubject}
              onDeleteIntent={handleDeleteIntent}
              onToggleVisibility={handleToggleVisibility}
              onToggleAutoReply={handleToggleAutoReply}
            />
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
