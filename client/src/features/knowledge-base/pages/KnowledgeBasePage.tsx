import { useState, useMemo } from "react";
import { Plus, BookOpen, X, Lightbulb, BarChart3, Cloud, Database, Tags, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { HierarchyNodeItem } from "../components/HierarchyNodeItem";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { ZendeskArticlesPage } from "./ZendeskArticlesPage";
import { SubjectsIntentsPage } from "./SubjectsIntentsPage";
import { SegmentedTabs, FilterBar } from "../../../shared/components/ui";
import { useKnowledgeBase } from "../hooks/useKnowledgeBase";

const tabs = [
  { id: "articles", label: "Artigos", icon: <BookOpen className="w-4 h-4" /> },
  { id: "subjects", label: "Assuntos e Intenções", icon: <Tags className="w-4 h-4" /> },
  { id: "suggestions", label: "Sugestões", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "processing", label: "Processamento", icon: <BarChart3 className="w-4 h-4" /> },
];

const baseTabs = [
  { id: "internal", label: "Base interna", icon: <Database className="w-4 h-4" /> },
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

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [activeBaseTab, setActiveBaseTab] = useState("internal");
  const [prefilledData, setPrefilledData] = useState<PrefilledArticleData | null>(null);
  
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

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Base de Conhecimento
          </h2>
        </div>
        <SegmentedTabs
          tabs={baseTabs}
          activeTab={activeBaseTab}
          onChange={setActiveBaseTab}
          iconOnlyMobile
        />
      </div>

      {activeBaseTab === "zendesk" ? (
        <div className="p-4">
          <ZendeskArticlesPage />
        </div>
      ) : (
        <>
          <div className="px-4 py-3 border-b">
            <SegmentedTabs
              tabs={tabs}
              activeTab={activeTab}
              onChange={setActiveTab}
              iconOnlyMobile
            />
          </div>

          {activeTab === "processing" ? (
            <div className="p-4">
              <LearningAttemptsPage />
            </div>
          ) : activeTab === "suggestions" ? (
            <div className="p-4">
              <SuggestionsPage />
            </div>
          ) : activeTab === "subjects" ? (
            <div className="p-4 h-[calc(100vh-220px)]">
              <SubjectsIntentsPage />
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
                  { type: "search", value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar...", width: "8rem" },
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
                    <div className="flex justify-between items-center mb-2">
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <span>{catalogStats.productsCount} Produtos</span>
                        <span className="text-gray-300">|</span>
                        <span>{catalogStats.subproductsCount} Subprodutos</span>
                        <span className="text-gray-300">|</span>
                        <span>{catalogStats.subjectsCount} Assuntos</span>
                        <span className="text-gray-300">|</span>
                        <span>{catalogStats.intentsCount} Intenções</span>
                        <span className="text-gray-300">|</span>
                        <span>{catalogStats.articlesCount} Artigos</span>
                        <span className="text-gray-300">|</span>
                        <span>{catalogStats.embeddingsCount} Embeddings</span>
                      </div>
                      <button
                        onClick={isAllArticlesExpanded ? collapseAllPaths : expandAllPaths}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        {isAllArticlesExpanded ? (
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
    </div>
  );
}
