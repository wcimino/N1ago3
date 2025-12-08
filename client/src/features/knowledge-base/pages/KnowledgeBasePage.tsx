import { useState } from "react";
import { Plus, Search, BookOpen, X, Lightbulb, BarChart3 } from "lucide-react";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { HierarchyNodeItem } from "../components/HierarchyNodeItem";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { SegmentedTabs } from "../../../shared/components/ui";
import { useKnowledgeBase } from "../hooks/useKnowledgeBase";

const tabs = [
  { id: "articles", label: "Artigos", icon: <BookOpen className="w-4 h-4" /> },
  { id: "suggestions", label: "Sugestões", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "processing", label: "Processamento", icon: <BarChart3 className="w-4 h-4" /> },
];

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  
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
    setSelectedProduct,
    selectedIntent,
    setSelectedIntent,
    expandedPaths,
    createMutation,
    updateMutation,
    handleSubmit,
    handleEdit,
    handleDelete,
    handleCancel,
    togglePath,
  } = useKnowledgeBase(activeTab);

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5" />
            Base de Conhecimento
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            Repositório de informações para apoio ao atendimento
          </p>
        </div>
        {activeTab === "articles" && !showForm && (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Novo Artigo</span>
          </button>
        )}
      </div>

      <div className="px-4 py-3 border-b">
        <SegmentedTabs
          tabs={tabs}
          activeTab={activeTab}
          onChange={setActiveTab}
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
      ) : showForm ? (
        <div className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium">
              {editingArticle ? "Editar Artigo" : "Novo Artigo"}
            </h3>
            <button
              onClick={handleCancel}
              className="p-2 text-gray-500 hover:text-gray-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <KnowledgeBaseForm
            initialData={editingArticle}
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createMutation.isPending || updateMutation.isPending}
          />
        </div>
      ) : (
        <>
          <div className="px-4 py-2 border-b">
            <div className="flex gap-2 items-center">
              <div className="flex-1 relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-w-[120px]"
              >
                <option value="">Produto</option>
                {filters?.products.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
              <select
                value={selectedIntent}
                onChange={(e) => setSelectedIntent(e.target.value)}
                className="px-2 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 max-w-[100px]"
              >
                <option value="">Intenção</option>
                <option value="suporte">suporte</option>
                <option value="contratar">contratar</option>
              </select>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : hierarchy.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum produto cadastrado</p>
                <p className="text-sm mt-1">Cadastre produtos em Configurações &gt; Cadastro &gt; Produtos</p>
              </div>
            ) : (
              <div className="space-y-1 border rounded-lg p-3 max-h-[500px] overflow-y-auto">
                {hierarchy.map((node) => (
                  <HierarchyNodeItem
                    key={node.fullPath}
                    node={node}
                    depth={0}
                    expandedPaths={expandedPaths}
                    onToggle={togglePath}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
