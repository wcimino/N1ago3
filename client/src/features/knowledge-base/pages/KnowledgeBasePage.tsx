import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, BookOpen, X, Lightbulb, BarChart3, ChevronRight, ChevronDown, Pencil, Trash2, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import { SuggestionsPage } from "./SuggestionsPage";
import { LearningAttemptsPage } from "./LearningAttemptsPage";
import { SegmentedTabs } from "../../../shared/components/ui";

interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  category1: string | null;
  category2: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  createdAt: string;
  updatedAt: string;
}

interface KnowledgeBaseFormData {
  name: string | null;
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

interface CatalogProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
}

interface HierarchyNode {
  name: string;
  level: "produto" | "subproduto" | "categoria1" | "categoria2";
  fullPath: string;
  children: HierarchyNode[];
  articles: KnowledgeBaseArticle[];
}

function buildHierarchy(products: CatalogProduct[], articles: KnowledgeBaseArticle[]): HierarchyNode[] {
  const productNodes = new Map<string, HierarchyNode>();
  
  for (const product of products) {
    if (!productNodes.has(product.produto)) {
      productNodes.set(product.produto, {
        name: product.produto,
        level: "produto",
        fullPath: product.produto,
        children: [],
        articles: [],
      });
    }
    
    const prodNode = productNodes.get(product.produto)!;
    
    if (product.subproduto) {
      let subNode = prodNode.children.find(c => c.name === product.subproduto);
      if (!subNode) {
        subNode = {
          name: product.subproduto,
          level: "subproduto",
          fullPath: `${product.produto} > ${product.subproduto}`,
          children: [],
          articles: [],
        };
        prodNode.children.push(subNode);
      }
      
      if (product.categoria1) {
        let cat1Node = subNode.children.find(c => c.name === product.categoria1);
        if (!cat1Node) {
          cat1Node = {
            name: product.categoria1,
            level: "categoria1",
            fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1}`,
            children: [],
            articles: [],
          };
          subNode.children.push(cat1Node);
        }
        
        if (product.categoria2) {
          let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
          if (!cat2Node) {
            cat2Node = {
              name: product.categoria2,
              level: "categoria2",
              fullPath: `${product.produto} > ${product.subproduto} > ${product.categoria1} > ${product.categoria2}`,
              children: [],
              articles: [],
            };
            cat1Node.children.push(cat2Node);
          }
        }
      }
    }
  }
  
  for (const article of articles) {
    const prodNode = productNodes.get(article.productStandard);
    if (!prodNode) {
      if (!productNodes.has(article.productStandard)) {
        productNodes.set(article.productStandard, {
          name: article.productStandard,
          level: "produto",
          fullPath: article.productStandard,
          children: [],
          articles: [],
        });
      }
      productNodes.get(article.productStandard)!.articles.push(article);
      continue;
    }
    
    if (article.subproductStandard) {
      const subNode = prodNode.children.find(c => c.name === article.subproductStandard);
      if (subNode) {
        if (article.category1) {
          const cat1Node = subNode.children.find(c => c.name === article.category1);
          if (cat1Node) {
            if (article.category2) {
              const cat2Node = cat1Node.children.find(c => c.name === article.category2);
              if (cat2Node) {
                cat2Node.articles.push(article);
              } else {
                cat1Node.articles.push(article);
              }
            } else {
              cat1Node.articles.push(article);
            }
          } else {
            subNode.articles.push(article);
          }
        } else {
          subNode.articles.push(article);
        }
      } else {
        prodNode.articles.push(article);
      }
    } else {
      prodNode.articles.push(article);
    }
  }
  
  return Array.from(productNodes.values()).sort((a, b) => a.name.localeCompare(b.name));
}

function countArticles(node: HierarchyNode): number {
  let count = node.articles.length;
  for (const child of node.children) {
    count += countArticles(child);
  }
  return count;
}

interface HierarchyNodeItemProps {
  node: HierarchyNode;
  depth: number;
  expandedPaths: Set<string>;
  onToggle: (path: string) => void;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
}

const levelColors = {
  produto: { bg: "bg-blue-100", text: "text-blue-800", border: "border-blue-200" },
  subproduto: { bg: "bg-green-100", text: "text-green-700", border: "border-green-200" },
  categoria1: { bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  categoria2: { bg: "bg-orange-100", text: "text-orange-700", border: "border-orange-200" },
};

const levelLabels = {
  produto: "Produto",
  subproduto: "Subproduto",
  categoria1: "Categoria 1",
  categoria2: "Categoria 2",
};

function HierarchyNodeItem({ node, depth, expandedPaths, onToggle, onEdit, onDelete }: HierarchyNodeItemProps) {
  const isExpanded = expandedPaths.has(node.fullPath);
  const hasChildren = node.children.length > 0 || node.articles.length > 0;
  const articleCount = countArticles(node);
  const colors = levelColors[node.level];
  
  return (
    <div>
      <div 
        className={`flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 ${hasChildren ? "cursor-pointer" : ""}`}
        style={{ marginLeft: `${depth * 20}px` }}
        onClick={() => hasChildren && onToggle(node.fullPath)}
      >
        {hasChildren ? (
          <button className="p-0.5 rounded hover:bg-gray-200">
            {isExpanded ? (
              <ChevronDown className="w-4 h-4 text-gray-500" />
            ) : (
              <ChevronRight className="w-4 h-4 text-gray-500" />
            )}
          </button>
        ) : (
          <div className="w-5" />
        )}

        <span className={`px-2 py-0.5 text-xs rounded border ${colors.bg} ${colors.text} ${colors.border}`}>
          {levelLabels[node.level]}
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{node.name}</span>

        {articleCount === 0 ? (
          <span className="flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700">
            <AlertCircle className="w-3 h-3" />
            Sem artigos
          </span>
        ) : (
          <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600">
            {articleCount}
          </span>
        )}
      </div>

      {isExpanded && (
        <div>
          {node.children.map((child) => (
            <HierarchyNodeItem
              key={child.fullPath}
              node={child}
              depth={depth + 1}
              expandedPaths={expandedPaths}
              onToggle={onToggle}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
          {node.articles.map((article) => (
            <div 
              key={article.id}
              className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
              style={{ marginLeft: `${(depth + 1) * 20}px` }}
            >
              <div className="w-5" />

              <div className="flex-1 min-w-0">
                <span className="text-sm text-gray-900 truncate block">
                  {article.name || article.description.substring(0, 60)}
                </span>
              </div>

              <span className={`px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide rounded ${
                article.intent === "contratar" 
                  ? "bg-emerald-500 text-white" 
                  : "bg-slate-500 text-white"
              }`}>
                {article.intent}
              </span>

              <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block">
                {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
              </span>

              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={(e) => { e.stopPropagation(); onEdit(article); }}
                  className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
                  title="Editar"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
                  className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
                  title="Excluir"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
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
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());
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

  const { data: catalogProducts = [] } = useQuery<CatalogProduct[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      if (!res.ok) throw new Error("Failed to fetch catalog");
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

  const hierarchy = useMemo(() => buildHierarchy(catalogProducts, articles), [catalogProducts, articles]);

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

  const togglePath = (path: string) => {
    setExpandedPaths(prev => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
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
