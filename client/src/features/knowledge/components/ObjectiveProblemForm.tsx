import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, ChevronDown, X, MessageSquare } from "lucide-react";
import { FormField } from "../../../shared/components/crud";
import { FormActions } from "../../../shared/components/ui";

interface Product {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

export interface ObjectiveProblemFormData {
  name: string;
  description: string;
  synonyms: string;
  examples: string;
  presentedBy: "customer" | "system" | "both";
  isActive: boolean;
  productIds: number[];
}

export const emptyObjectiveProblemForm: ObjectiveProblemFormData = {
  name: "",
  description: "",
  synonyms: "",
  examples: "",
  presentedBy: "customer",
  isActive: true,
  productIds: [],
};

export const transformObjectiveProblemFormData = (data: ObjectiveProblemFormData) => ({
  name: data.name,
  description: data.description,
  synonyms: data.synonyms.split("\n").map(s => s.trim()).filter(Boolean),
  examples: data.examples.split("\n").map(s => s.trim()).filter(Boolean),
  presentedBy: data.presentedBy,
  isActive: data.isActive,
  productIds: data.productIds,
});

interface ObjectiveProblemFormProps {
  formData: ObjectiveProblemFormData;
  setFormData: React.Dispatch<React.SetStateAction<ObjectiveProblemFormData>>;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
  isEditing: boolean;
  isMutating: boolean;
  problemNormalized?: string | null;
}

export function ObjectiveProblemForm({
  formData,
  setFormData,
  onSubmit,
  onCancel,
  isEditing,
  isMutating,
  problemNormalized,
}: ObjectiveProblemFormProps) {
  const [expandedProducts, setExpandedProducts] = useState<Set<string>>(new Set());

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ["/api/knowledge/objective-problems/products"],
  });

  const toggleExpanded = (productName: string) => {
    setExpandedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productName)) next.delete(productName);
      else next.add(productName);
      return next;
    });
  };

  const toggleProduct = (productId: number) => {
    setFormData(prev => ({
      ...prev,
      productIds: prev.productIds.includes(productId)
        ? prev.productIds.filter(id => id !== productId)
        : [...prev.productIds, productId],
    }));
  };

  const groupedProducts = useMemo(() => {
    return products.reduce((acc, product) => {
      const mainProduct = product.produto;
      if (!acc[mainProduct]) acc[mainProduct] = [];
      acc[mainProduct].push(product);
      return acc;
    }, {} as Record<string, Product[]>);
  }, [products]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">
          {isEditing ? "Editar Problema" : "Novo Problema"}
        </h3>
        <button onClick={onCancel} className="p-2 text-gray-500 hover:text-gray-700">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-4">
          <FormField
            type="text"
            label="Nome"
            required
            value={formData.name}
            onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
            placeholder="Ex: Transacao recusada"
          />

          <FormField
            type="textarea"
            label="Descricao"
            required
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            rows={2}
            placeholder="Descricao detalhada do problema"
          />

          {problemNormalized && (
            <div>
              <label className="flex items-center gap-1.5 text-xs font-medium text-purple-600 mb-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                Problema Normalizado
                <span className="text-xs text-gray-400 font-normal ml-1">(gerado por IA)</span>
              </label>
              <div className="w-full px-3 py-2 text-sm border border-purple-200 rounded-lg bg-purple-50 text-purple-900">
                {problemNormalized}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <FormField
              type="textarea"
              label="Sinonimos (um por linha)"
              value={formData.synonyms}
              onChange={(e) => setFormData(prev => ({ ...prev, synonyms: e.target.value }))}
              rows={4}
              placeholder="Pagamento negado&#10;Recusa de cartao"
            />

            <FormField
              type="textarea"
              label="Exemplos de frases (um por linha)"
              value={formData.examples}
              onChange={(e) => setFormData(prev => ({ ...prev, examples: e.target.value }))}
              rows={4}
              placeholder="Meu cartao nao passou&#10;Nao consegui pagar"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Produtos relacionados (opcional)
            </label>
            <div className="border border-gray-300 rounded-lg max-h-48 overflow-y-auto">
              {products.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-2">Nenhum produto disponivel</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {Object.entries(groupedProducts).map(([mainProduct, subProducts]) => {
                    const isExpanded = expandedProducts.has(mainProduct);
                    const generalProduct = subProducts.find(p => !p.subproduto);
                    const specificProducts = subProducts.filter(p => p.subproduto);
                    const selectedCount = subProducts.filter(p => formData.productIds.includes(p.id)).length;
                    
                    return (
                      <div key={mainProduct}>
                        <div className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                          {specificProducts.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => toggleExpanded(mainProduct)}
                              className="p-0.5"
                            >
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                            </button>
                          ) : <div className="w-5" />}
                          
                          {generalProduct && (
                            <input
                              type="checkbox"
                              checked={formData.productIds.includes(generalProduct.id)}
                              onChange={() => toggleProduct(generalProduct.id)}
                              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                            />
                          )}
                          
                          <span className="font-medium text-gray-900 text-sm">{mainProduct}</span>
                          {specificProducts.length > 0 && <span className="text-xs text-gray-400">{specificProducts.length}</span>}
                          {selectedCount > 0 && (
                            <span className="ml-auto text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">{selectedCount}</span>
                          )}
                        </div>
                        
                        {isExpanded && specificProducts.length > 0 && (
                          <div className="bg-gray-50 border-t border-gray-100">
                            {specificProducts.map((product) => (
                              <label key={product.id} className="flex items-center gap-2 px-3 py-1.5 pl-10 hover:bg-gray-100 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={formData.productIds.includes(product.id)}
                                  onChange={() => toggleProduct(product.id)}
                                  className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                />
                                <span className="text-sm text-gray-700">{product.subproduto}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            {formData.productIds.length > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {formData.productIds.length} produto{formData.productIds.length !== 1 ? "s" : ""} selecionado{formData.productIds.length !== 1 ? "s" : ""}
              </p>
            )}
          </div>

          <FormField
            type="select"
            label="Apresentado por"
            value={formData.presentedBy}
            onChange={(e) => setFormData(prev => ({ ...prev, presentedBy: e.target.value as ObjectiveProblemFormData["presentedBy"] }))}
            options={[
              { value: "customer", label: "Cliente" },
              { value: "system", label: "Sistema" },
              { value: "both", label: "Ambos" },
            ]}
          />

          <FormField
            type="checkbox"
            label="Ativo"
            id="isActive"
            checked={formData.isActive}
            onChange={(e) => setFormData(prev => ({ ...prev, isActive: e.target.checked }))}
          />

          <FormActions
            isLoading={isMutating}
            isEditing={isEditing}
            onCancel={onCancel}
            className="pt-2"
          />
        </div>
      </form>
    </div>
  );
}
