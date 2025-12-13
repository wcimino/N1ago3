import { useLocation } from "wouter";
import { 
  Plus, Loader2, AlertCircle, CheckCircle2, ArrowLeft
} from "lucide-react";
import { ProductTreeNode } from "../../../lib/productHierarchy";
import { TreeView } from "../../../shared/components/ui";
import { ProductAddForm, ProductEditForm } from "../components";
import { ProductTreeActions } from "../components/ProductTreeActions";
import { useProductCatalog } from "../hooks";

export function ProductCatalogPage() {
  const [, navigate] = useLocation();
  const {
    tree,
    isLoading,
    showSuccess,
    error,
    expandedNodes,
    toggleNode,
    addingTo,
    editingNode,
    createMutation,
    updateMutation,
    deleteMutation,
    handleAdd,
    handleAddSubmit,
    handleStartAddProduto,
    handleEdit,
    handleEditSubmit,
    handleCancelAdd,
    handleCancelEdit,
  } = useProductCatalog();

  const renderNodeActions = (node: ProductTreeNode) => (
    <ProductTreeActions
      node={node}
      onAdd={handleAdd}
      onEdit={handleEdit}
      onDelete={(id) => deleteMutation.mutate(id)}
      isDeleting={deleteMutation.isPending}
    />
  );

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
          <ProductAddForm
            parentNode={addingTo.parentNode}
            level={addingTo.level}
            onSubmit={handleAddSubmit}
            onCancel={handleCancelAdd}
            isPending={createMutation.isPending}
          />
        )}

        {editingNode && (
          <ProductEditForm
            node={editingNode}
            onSubmit={handleEditSubmit}
            onCancel={handleCancelEdit}
            isPending={updateMutation.isPending}
          />
        )}

        <div className="flex justify-between items-center mb-4">
          <h4 className="text-sm font-medium text-gray-700">Catálogo de Produtos</h4>
          {!addingTo && (
            <button
              onClick={handleStartAddProduto}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary text-white rounded-lg hover:bg-primary-900 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Novo Produto
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />
          </div>
        ) : (
          <div className="border rounded-lg p-3 max-h-[500px] overflow-y-auto">
            <TreeView
              nodes={tree}
              expandedNodes={expandedNodes}
              onToggle={toggleNode}
              renderActions={renderNodeActions}
              emptyMessage="Nenhum produto cadastrado. Clique em 'Novo Produto' para começar."
            />
          </div>
        )}
      </div>
    </div>
  );
}
