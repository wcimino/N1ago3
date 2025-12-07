import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, BookOpen, X, Lightbulb } from "lucide-react";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { KnowledgeBaseCard } from "../components/KnowledgeBaseCard";
import { SuggestionsPage } from "./SuggestionsPage";
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

const tabs = [
  { id: "articles", label: "Artigos", icon: <BookOpen className="w-4 h-4" /> },
  { id: "suggestions", label: "Sugestões", icon: <Lightbulb className="w-4 h-4" /> },
];

export function KnowledgeBasePage() {
  const [activeTab, setActiveTab] = useState("articles");
  const [showForm, setShowForm] = useState(false);
  const [editingArticle, setEditingArticle] = useState<KnowledgeBaseArticle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedIntent, setSelectedIntent] = useState("");
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

      {activeTab === "suggestions" ? (
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
            ) : articles.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <BookOpen className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                <p>Nenhum artigo encontrado</p>
                <p className="text-sm mt-1">Clique em "Novo Artigo" para adicionar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {articles.map((article) => (
                  <KnowledgeBaseCard
                    key={article.id}
                    article={article}
                    onEdit={() => handleEdit(article)}
                    onDelete={() => handleDelete(article.id)}
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
