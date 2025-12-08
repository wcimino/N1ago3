import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { 
  Package, Plus, Trash2, Loader2, AlertCircle, CheckCircle2, ArrowLeft,
  ChevronRight, ChevronDown, Pencil
} from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

interface IfoodProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2: string | null;
  fullName: string;
  createdAt: string;
  updatedAt: string;
}

type LevelType = "produto" | "subproduto" | "categoria1" | "categoria2";

interface Ancestry {
  produto: string;
  subproduto: string | null;
  categoria1: string | null;
  categoria2?: string | null;
}

interface TreeNode {
  name: string;
  level: LevelType;
  children: TreeNode[];
  productId?: number;
  ancestry: Ancestry;
}

function buildTree(products: IfoodProduct[]): TreeNode[] {
  const tree: TreeNode[] = [];
  const produtoMap = new Map<string, TreeNode>();

  for (const product of products) {
    let produtoNode = produtoMap.get(product.produto);
    if (!produtoNode) {
      produtoNode = {
        name: product.produto,
        level: "produto",
        children: [],
        ancestry: { produto: product.produto, subproduto: null, categoria1: null },
      };
      produtoMap.set(product.produto, produtoNode);
      tree.push(produtoNode);
    }

    if (!product.subproduto && !product.categoria1 && !product.categoria2) {
      produtoNode.productId = product.id;
      continue;
    }

    if (product.subproduto) {
      let subprodutoNode = produtoNode.children.find(
        c => c.name === product.subproduto && c.level === "subproduto"
      );
      if (!subprodutoNode) {
        subprodutoNode = {
          name: product.subproduto,
          level: "subproduto",
          children: [],
          ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: null },
        };
        produtoNode.children.push(subprodutoNode);
      }

      if (!product.categoria1 && !product.categoria2) {
        subprodutoNode.productId = product.id;
        continue;
      }

      if (product.categoria1) {
        let cat1Node = subprodutoNode.children.find(c => c.name === product.categoria1);
        if (!cat1Node) {
          cat1Node = {
            name: product.categoria1,
            level: "categoria1",
            children: [],
            ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: product.categoria1 },
          };
          subprodutoNode.children.push(cat1Node);
        }

        if (!product.categoria2) {
          cat1Node.productId = product.id;
          continue;
        }

        let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
        if (!cat2Node) {
          cat2Node = {
            name: product.categoria2,
            level: "categoria2",
            children: [],
            ancestry: { produto: product.produto, subproduto: product.subproduto, categoria1: product.categoria1 },
            productId: product.id,
          };
          cat1Node.children.push(cat2Node);
        } else {
          cat2Node.productId = product.id;
        }
      }
    } else if (product.categoria1) {
      let cat1Node = produtoNode.children.find(
        c => c.name === product.categoria1 && c.level === "categoria1"
      );
      if (!cat1Node) {
        cat1Node = {
          name: product.categoria1,
          level: "categoria1",
          children: [],
          ancestry: { produto: product.produto, subproduto: null, categoria1: product.categoria1 },
        };
        produtoNode.children.push(cat1Node);
      }

      if (!product.categoria2) {
        cat1Node.productId = product.id;
      } else {
        let cat2Node = cat1Node.children.find(c => c.name === product.categoria2);
        if (!cat2Node) {
          cat2Node = {
            name: product.categoria2,
            level: "categoria2",
            children: [],
            ancestry: { produto: product.produto, subproduto: null, categoria1: product.categoria1 },
            productId: product.id,
          };
          cat1Node.children.push(cat2Node);
        }
      }
    }
  }

  return tree.sort((a, b) => a.name.localeCompare(b.name));
}

function getNodeKey(node: TreeNode): string {
  const parts = [node.ancestry.produto];
  if (node.ancestry.subproduto) parts.push(`sub:${node.ancestry.subproduto}`);
  if (node.ancestry.categoria1) parts.push(`c1:${node.ancestry.categoria1}`);
  if (node.level === "categoria2") parts.push(`c2:${node.name}`);
  else if (node.level === "categoria1" && !node.ancestry.subproduto) parts.push(`c1direct:${node.name}`);
  else if (node.level === "subproduto") parts.push(`sub:${node.name}`);
  return parts.join("|");
}

function getDisplayPath(ancestry: Ancestry, currentName?: string): string {
  const parts = [ancestry.produto];
  if (ancestry.subproduto) parts.push(ancestry.subproduto);
  if (ancestry.categoria1) parts.push(ancestry.categoria1);
  if (currentName) parts.push(currentName);
  return parts.join(" > ");
}

interface TreeItemProps {
  node: TreeNode;
  onDelete: (id: number) => void;
  onAdd: (node: TreeNode, level: LevelType) => void;
  onEdit: (node: TreeNode) => void;
  isDeleting: boolean;
  expandedNodes: Set<string>;
  toggleNode: (key: string) => void;
  depth: number;
}

function TreeItem({ node, onDelete, onAdd, onEdit, isDeleting, expandedNodes, toggleNode, depth }: TreeItemProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const nodeKey = getNodeKey(node);
  const isExpanded = expandedNodes.has(nodeKey);
  const hasChildren = node.children.length > 0;
  const canAddChildren = node.level !== "categoria2";

  const levelColors: Record<LevelType, string> = {
    produto: "bg-blue-100 text-blue-800 border-blue-200",
    subproduto: "bg-green-100 text-green-800 border-green-200",
    categoria1: "bg-purple-100 text-purple-800 border-purple-200",
    categoria2: "bg-orange-100 text-orange-800 border-orange-200",
  };

  const levelLabels: Record<LevelType, string> = {
    produto: "Produto",
    subproduto: "Subproduto",
    categoria1: "Categoria 1",
    categoria2: "Categoria 2",
  };

  const getNextLevels = (level: LevelType): LevelType[] => {
    switch (level) {
      case "produto": return ["subproduto", "categoria1"];
      case "subproduto": return ["categoria1"];
      case "categoria1": return ["categoria2"];
      default: return [];
    }
  };

  const nextLevels = getNextLevels(node.level);

  const handleAddClick = () => {
    if (nextLevels.length === 1) {
      onAdd(node, nextLevels[0]);
    } else {
      setShowAddMenu(!showAddMenu);
    }
  };

  return (
    <div className="space-y-1">
      <div 
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 group"
        style={{ marginLeft: `${depth * 24}px` }}
      >
        <button
          onClick={() => toggleNode(nodeKey)}
          className={`p-0.5 rounded ${hasChildren || canAddChildren ? "hover:bg-gray-200" : "invisible"}`}
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-500" />
          ) : (
            <ChevronRight className="w-4 h-4 text-gray-500" />
          )}
        </button>

        <span className={`px-2 py-0.5 text-xs rounded border ${levelColors[node.level]}`}>
          {levelLabels[node.level]}
        </span>

        <span className="flex-1 text-sm font-medium text-gray-900">{node.name}</span>

        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity relative">
          {canAddChildren && nextLevels.length > 0 && (
            <div className="relative">
              <button
                onClick={handleAddClick}
                className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                title="Adicionar"
              >
                <Plus className="w-4 h-4" />
              </button>
              {showAddMenu && nextLevels.length > 1 && (
                <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg py-1 z-10 min-w-[140px]">
                  {nextLevels.map((level) => (
                    <button
                      key={level}
                      onClick={() => {
                        onAdd(node, level);
                        setShowAddMenu(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {levelLabels[level]}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {node.productId && (
            <button
              onClick={() => onEdit(node)}
              className="p-1 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
              title="Editar"
            >
              <Pencil className="w-4 h-4" />
            </button>
          )}
          {node.productId && (
            <button
              onClick={() => onDelete(node.productId!)}
              disabled={isDeleting}
              className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
              title="Excluir"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isExpanded && node.children.length > 0 && (
        <div>
          {node.children.map((child) => (
            <TreeItem
              key={getNodeKey(child)}
              node={child}
              onDelete={onDelete}
              onAdd={onAdd}
              onEdit={onEdit}
              isDeleting={isDeleting}
              expandedNodes={expandedNodes}
              toggleNode={toggleNode}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface AddFormProps {
  parentNode: TreeNode | null;
  level: LevelType;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

const levelLabels: Record<LevelType, string> = {
  produto: "Produto",
  subproduto: "Subproduto",
  categoria1: "Categoria 1",
  categoria2: "Categoria 2",
};

function AddForm({ parentNode, level, onSubmit, onCancel, isPending }: AddFormProps) {
  const [name, setName] = useState("");

  const getParentDisplayPath = (): string => {
    if (!parentNode) return "";
    if (parentNode.level === "produto") return parentNode.name;
    return getDisplayPath(parentNode.ancestry, parentNode.name);
  };

  const parentPath = getParentDisplayPath();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            {parentPath ? (
              <>Adicionar {levelLabels[level]} em: <span className="text-blue-600">{parentPath}</span></>
            ) : (
              <>Adicionar novo {levelLabels[level]}</>
            )}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nome do ${levelLabels[level].toLowerCase()}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !name.trim()}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Adicionar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

interface EditFormProps {
  node: TreeNode;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

function EditForm({ node, onSubmit, onCancel, isPending }: EditFormProps) {
  const [name, setName] = useState(node.name);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim() && name.trim() !== node.name) {
      onSubmit(name.trim());
    }
  };

  return (
    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Editar {levelLabels[node.level]}: <span className="text-yellow-700">{node.name}</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nome do ${levelLabels[node.level].toLowerCase()}`}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-yellow-500 text-sm"
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isPending || !name.trim() || name.trim() === node.name}
            className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4" />}
            Salvar
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm font-medium"
          >
            Cancelar
          </button>
        </div>
      </form>
    </div>
  );
}

export function IfoodProductsPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [addingTo, setAddingTo] = useState<{ parentNode: TreeNode | null; level: LevelType } | null>(null);
  const [editingNode, setEditingNode] = useState<TreeNode | null>(null);

  const { data: products, isLoading } = useQuery<IfoodProduct[]>({
    queryKey: ["ifood-products"],
    queryFn: () => fetchApi<IfoodProduct[]>("/api/ifood-products"),
  });

  const tree = useMemo(() => buildTree(products || []), [products]);

  const createMutation = useMutation({
    mutationFn: async (data: { produto: string; subproduto: string | null; categoria1: string | null; categoria2: string | null }) => {
      return apiRequest("POST", "/api/ifood-products", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ifood-products"] });
      queryClient.invalidateQueries({ queryKey: ["ifood-products-fullnames"] });
      setAddingTo(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao criar produto");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/ifood-products/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ifood-products"] });
      queryClient.invalidateQueries({ queryKey: ["ifood-products-fullnames"] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...data }: { id: number; produto: string; subproduto: string | null; categoria1: string | null; categoria2: string | null }) => {
      return apiRequest("PUT", `/api/ifood-products/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ifood-products"] });
      queryClient.invalidateQueries({ queryKey: ["ifood-products-fullnames"] });
      setEditingNode(null);
      setError(null);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
    onError: (err: any) => {
      setError(err.message || "Erro ao atualizar produto");
    },
  });

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleAdd = (parentNode: TreeNode, level: LevelType) => {
    const nodeKey = getNodeKey(parentNode);
    if (!expandedNodes.has(nodeKey)) {
      setExpandedNodes(prev => new Set(prev).add(nodeKey));
    }
    setAddingTo({ parentNode, level });
  };

  const handleAddSubmit = (name: string) => {
    if (!addingTo) return;

    const { parentNode, level } = addingTo;

    let data: { produto: string; subproduto: string | null; categoria1: string | null; categoria2: string | null };

    if (level === "produto") {
      data = { produto: name, subproduto: null, categoria1: null, categoria2: null };
    } else if (level === "subproduto") {
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: name, 
        categoria1: null, 
        categoria2: null 
      };
    } else if (level === "categoria1") {
      const subproduto = parentNode!.level === "subproduto" 
        ? parentNode!.name 
        : parentNode!.ancestry.subproduto;
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: subproduto,
        categoria1: name, 
        categoria2: null 
      };
    } else {
      data = { 
        produto: parentNode!.ancestry.produto, 
        subproduto: parentNode!.ancestry.subproduto,
        categoria1: parentNode!.level === "categoria1" ? parentNode!.name : parentNode!.ancestry.categoria1, 
        categoria2: name 
      };
    }

    createMutation.mutate(data);
  };

  const handleStartAddProduto = () => {
    setAddingTo({ parentNode: null, level: "produto" });
  };

  const handleEdit = (node: TreeNode) => {
    setEditingNode(node);
    setAddingTo(null);
  };

  const handleEditSubmit = (newName: string) => {
    if (!editingNode || !editingNode.productId) return;

    const level = editingNode.level;
    let data: { produto: string; subproduto: string | null; categoria1: string | null; categoria2: string | null };

    if (level === "produto") {
      data = { 
        produto: newName, 
        subproduto: null, 
        categoria1: null, 
        categoria2: null 
      };
    } else if (level === "subproduto") {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: newName, 
        categoria1: null, 
        categoria2: null 
      };
    } else if (level === "categoria1") {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: editingNode.ancestry.subproduto,
        categoria1: newName, 
        categoria2: null 
      };
    } else {
      data = { 
        produto: editingNode.ancestry.produto, 
        subproduto: editingNode.ancestry.subproduto,
        categoria1: editingNode.ancestry.categoria1, 
        categoria2: newName 
      };
    }

    updateMutation.mutate({ id: editingNode.productId, ...data });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate("/settings/catalog")}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Produtos iFood Pago</h1>
          <p className="text-gray-600 mt-1 text-sm sm:text-base">Cadastre os produtos disponíveis para padronização</p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow p-4 sm:p-6">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-sm text-blue-800">
            <strong>Hierarquia:</strong> Produto → Subproduto (opcional) → Categoria 1 (opcional) → Categoria 2 (opcional)
          </p>
          <p className="text-xs text-blue-600 mt-1">
            Clique no <Plus className="w-3 h-3 inline" /> para adicionar itens dentro de cada nível
          </p>
        </div>

        {error && (
          <div className="flex items-center gap-2 text-red-600 text-sm mb-4 p-3 bg-red-50 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {showSuccess && (
          <div className="flex items-center gap-2 text-green-600 text-sm mb-4 p-3 bg-green-50 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
            Item cadastrado com sucesso!
          </div>
        )}

        {addingTo && (
          <AddForm
            parentNode={addingTo.parentNode}
            level={addingTo.level}
            onSubmit={handleAddSubmit}
            onCancel={() => setAddingTo(null)}
            isPending={createMutation.isPending}
          />
        )}

        {editingNode && (
          <EditForm
            node={editingNode}
            onSubmit={handleEditSubmit}
            onCancel={() => setEditingNode(null)}
            isPending={updateMutation.isPending}
          />
        )}

        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-medium text-gray-700">Catálogo de Produtos</h4>
          {!addingTo && (
            <button
              onClick={handleStartAddProduto}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : tree.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-10 h-10 mx-auto text-gray-300 mb-2" />
            <p className="text-sm">Nenhum produto cadastrado ainda.</p>
            <p className="text-xs text-gray-400 mt-1">Clique em "Novo Produto" para começar</p>
          </div>
        ) : (
          <div className="space-y-1 border rounded-lg p-3 max-h-[500px] overflow-y-auto">
            {tree.map((node) => (
              <TreeItem
                key={getNodeKey(node)}
                node={node}
                onDelete={(id) => deleteMutation.mutate(id)}
                onAdd={handleAdd}
                onEdit={handleEdit}
                isDeleting={deleteMutation.isPending}
                expandedNodes={expandedNodes}
                toggleNode={toggleNode}
                depth={0}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
