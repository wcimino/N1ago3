import { useState } from "react";
import { Plus, Loader2, Pencil } from "lucide-react";
import { 
  ProductTreeNode, 
  ProductLevelType,
  LEVEL_LABELS,
  getDisplayPath
} from "../../../lib/productHierarchy";

interface AddFormProps {
  parentNode: ProductTreeNode | null;
  level: ProductLevelType;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function ProductAddForm({ parentNode, level, onSubmit, onCancel, isPending }: AddFormProps) {
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
              <>Adicionar {LEVEL_LABELS[level]} em: <span className="text-blue-600">{parentPath}</span></>
            ) : (
              <>Adicionar novo {LEVEL_LABELS[level]}</>
            )}
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nome do ${LEVEL_LABELS[level].toLowerCase()}`}
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
  node: ProductTreeNode;
  onSubmit: (name: string) => void;
  onCancel: () => void;
  isPending: boolean;
}

export function ProductEditForm({ node, onSubmit, onCancel, isPending }: EditFormProps) {
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
            Editar {LEVEL_LABELS[node.level]}: <span className="text-yellow-700">{node.name}</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={`Nome do ${LEVEL_LABELS[node.level].toLowerCase()}`}
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
