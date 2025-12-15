import { useMemo } from "react";
import { BookOpen, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { HierarchyNodeItem } from "./HierarchyNodeItem";
import { FilterBar, StatsBar } from "../../../shared/components/ui";
import type { HierarchyNode, KnowledgeBaseArticle } from "../hooks";

interface CatalogStats {
  productsCount: number;
  subproductsCount: number;
  subjectsCount: number;
  intentsCount: number;
  articlesCount: number;
  embeddingsCount: number;
}

interface EmbeddingStats {
  withoutEmbedding: number;
  outdated: number;
}

interface FilterOption {
  id: number;
  name: string;
}

interface ArticlesHierarchyViewProps {
  isLoading: boolean;
  hierarchy: HierarchyNode[];
  expandedPaths: Set<string>;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedProduct: string;
  handleProductChange: (value: string) => void;
  selectedSubjectId: number | null;
  handleSubjectChange: (value: number | null) => void;
  selectedIntentId: number | null;
  setSelectedIntentId: (value: number | null) => void;
  filteredSubjects: FilterOption[];
  filteredIntents: FilterOption[];
  productOptions: string[];
  togglePath: (path: string) => void;
  expandAllPaths: () => void;
  collapseAllPaths: () => void;
  catalogStats: CatalogStats;
  embeddingStats: EmbeddingStats | null | undefined;
  generateEmbeddingsMutation: { mutate: () => void; isPending: boolean };
  intentViewCountMap: Map<number, number>;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
  onAddArticle: (subjectId?: number, intentId?: number, fullPath?: string, productCatalogId?: number) => void;
  onAddSubject: (productId: number) => void;
  onAddIntent: (subjectId: number) => void;
  onEditIntent: (intentId: number, intentName: string) => void;
  onEditSubject: (subjectId: number, subjectName: string) => void;
  onDeleteSubject: (subjectId: number, subjectName: string, hasArticles: boolean) => void;
  onDeleteIntent: (intentId: number, intentName: string, hasArticles: boolean) => void;
}

export function ArticlesHierarchyView({
  isLoading,
  hierarchy,
  expandedPaths,
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
  productOptions,
  togglePath,
  expandAllPaths,
  collapseAllPaths,
  catalogStats,
  embeddingStats,
  generateEmbeddingsMutation,
  intentViewCountMap,
  onEdit,
  onDelete,
  onAddArticle,
  onAddSubject,
  onAddIntent,
  onEditIntent,
  onEditSubject,
  onDeleteSubject,
  onDeleteIntent,
}: ArticlesHierarchyViewProps) {
  const allPathsCount = useMemo(() => {
    const count = (nodes: HierarchyNode[]): number => 
      nodes.reduce((acc, n) => acc + 1 + count(n.children), 0);
    return count(hierarchy);
  }, [hierarchy]);

  const isAllArticlesExpanded = expandedPaths.size >= allPathsCount && allPathsCount > 0;

  return (
    <>
      <FilterBar
        filters={[
          { type: "search", value: searchTerm, onChange: setSearchTerm, placeholder: "Buscar..." },
          { type: "select", value: selectedProduct, onChange: handleProductChange, placeholder: "Produto", options: productOptions },
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
                    onClick: embeddingStats && (embeddingStats.withoutEmbedding > 0 || embeddingStats.outdated > 0) 
                      ? () => generateEmbeddingsMutation.mutate() 
                      : undefined,
                    isLoading: generateEmbeddingsMutation.isPending,
                    highlight: embeddingStats ? (embeddingStats.withoutEmbedding > 0 || embeddingStats.outdated > 0) : undefined,
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
                  onEdit={onEdit}
                  onDelete={onDelete}
                  onAddArticle={onAddArticle}
                  onAddSubject={onAddSubject}
                  onAddIntent={onAddIntent}
                  onEditIntent={onEditIntent}
                  onEditSubject={onEditSubject}
                  onDeleteSubject={onDeleteSubject}
                  onDeleteIntent={onDeleteIntent}
                  intentViewCountMap={intentViewCountMap}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}
