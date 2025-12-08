import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, BookOpen, X, Lightbulb, BarChart3, ChevronRight, ChevronDown, Pencil, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { SegmentedTabs } from "../../../shared/components/ui";

interface KnowledgeBaseArticle {
  id: number;
  productStandard: string;
  subproductStandard: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseFormData {
  productStandard: string;
  subproductStandard: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
}

interface Filters {
  products: string[];
  intents: string[];
}

interface ProductGroup {
  product: string;
  articles: KnowledgeBaseArticle[];
}

function buildProductGroups(articles: KnowledgeBaseArticle[]): ProductGroup[] {
  const groupMap = new Map<string, KnowledgeBaseArticle[]>();
  
  for (const article of articles) {
    const product = article.productStandard;
    if (!groupMap.has(product)) {
      groupMap.set(product, []);
    }
    groupMap.get(product)!.push(article);
  }
  
  return Array.from(groupMap.entries())
    .map(([product, articles]) => ({ product, articles }))
    .sort((a, b) => a.product.localeCompare(b.product));
}

interface ArticleItemProps {
  article: KnowledgeBaseArticle;
  onEdit: () => void;
  onDelete: () => void;
  depth: number;
}

function ArticleItem({ article, onEdit, onDelete, depth }: ArticleItemProps) {
  return (
    <div 
      className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
      style={{ marginLeft: `${depth * 24}px` }}
    >
      <div className="w-4" />
      
      <span className="px-2 py-0.5 text-xs rounded border bg-purple-100 text-purple-800 border-purple-200">
        {article.intent}
      </span>

      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-gray-900 truncate block">
          {article.subproductStandard || article.description.substring(0, 50)}
        </span>
      </div>

      <span className="text-xs text-gray-400 whitespace-nowrap">
        {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
      </span>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onEdit}
          className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
          title="Editar"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface ProductGroupItemProps {
  group: ProductGroup;
  isExpanded: boolean;
  onToggle: () => void;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
}

function ProductGroupItem({ group, isExpanded, onToggle, onEdit, onDelete }: ProductGroupItemProps) {
  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-2 py-2.5 px-3 rounded-lg hover:bg-gray-50 cursor-pointer"
        onClick={onToggle}
      >
        <button className="p-0.5 rounded hover:bg-gray-200">
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <span className="px-2 py-0.5 text-xs rounded border bg-blue-100 text-blue-800 border-blue-200">
          Produto
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{group.product}</span>

        <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
          {group.articles.length}
        </span>
      </div>

      {isExpanded && (
        <div>
          {group.articles.map((article) => (
            <ArticleItem
              key={article.id}
              article={article}
              onEdit={() => onEdit(article)}
              onDelete={() => onDelete(article.id)}
              depth={1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const tabs = [
  { id: "articles", label: "Artigos", icon: <BookOpen className="w-4 h-4" /> },
  { id: "suggestions", label: "Sugestões", icon: <Lightbulb className="w-4 h-4" /> },
  { id: "processing", label: "Processamento", icon: <BarChart3 className="w-4 h-4" /> },
];

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIntent, setSelectedIntent] = useState("");
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const { data: articles = [], isLoading } = useQuery<KnowledgeBaseArticle[]>({
    queryKey: ["/api/knowledge-base", searchTerm, selectedProduct, selectedIntent],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchTerm) params.set("search", searchTerm);
      if (selectedProduct) params.set("productStandard", selectedProduct);
      if (selectedIntent) params.set("intent", selectedIntent);
      const res = await fetch(`/api/knowledge-base?${params}`);
      if (!res.ok) throw new Error("Failed to fetch articles");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const { data: filters } = useQuery<Filters>({
    queryKey: ["/api/knowledge-base/filters"],
    queryFn: async () => {
      const res = await fetch("/api/knowledge-base/filters");
      if (!res.ok) throw new Error("Failed to fetch filters");
      return res.json();
    },
    enabled: activeTab === "articles",
  });

  const productGroups = useMemo(() => buildProductGroups(articles), [articles]);

  const createMutation = useMutation({
    mutationFn: async (data: KnowledgeBaseFormData) => {
      const res = await fetch("/api/knowledge-base", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setShowForm(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: KnowledgeBaseFormData & { id: number }) => {
      const res = await fetch(`/api/knowledge-base/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update article");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
      setEditingArticle(null);
      setShowForm(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/knowledge-base/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete article");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/knowledge-base"] });
    },
  });

  const handleSubmit = (data: KnowledgeBaseFormData) => {
    if (editingArticle) {
      updateMutation.mutate({ id: editingArticle.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (article: KnowledgeBaseArticle) => {
    setEditingArticle(article);
    setShowForm(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Tem certeza que deseja excluir este artigo?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditingArticle(null);
  };

  const toggleProduct = (product: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(product)) {
        next.delete(product);
      } else {
        next.add(product);
      }
      return next;
    });
  };

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
                <option value="">Intent</option>
                {filters?.intents.map((intent) => (
                  <option key={intent} value={intent}>
                    {intent}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="p-4">
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Carregando...</div>
            ) : productGroups.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum artigo encontrado</p>
                <p className="text-sm mt-1">Clique em "Novo Artigo" para adicionar</p>
              </div>
            ) : (
              <div className="space-y-1 border rounded-lg p-3 max-h-[500px] overflow-y-auto">
                {productGroups.map((group) => (
                  <ProductGroupItem
                    key={group.product}
                    group={group}
                    isExpanded={expandedProducts.has(group.product)}
                    onToggle={() => toggleProduct(group.product)}
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
