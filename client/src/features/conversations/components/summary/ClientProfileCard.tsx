import { useState } from "react";
import { Building2, User2, ChevronDown, ChevronRight, Store, CreditCard, MapPin, FileText, Package, Banknote, Wallet, ShoppingBag } from "lucide-react";
import type { ClientHubData, ClientHubProduct, ClientHubSubproduct } from "./types";

interface ClientProfileCardProps {
  data?: ClientHubData | null;
}

interface FieldData {
  key: string;
  label: string;
  value: string;
  dataType: string;
  product?: ClientHubProduct;
  subproduct?: ClientHubSubproduct;
}

interface ProductGroup {
  product: ClientHubProduct | null;
  subproduct?: ClientHubSubproduct;
  fields: FieldData[];
}

interface CategoryGroup {
  category: string;
  products: Map<string, ProductGroup>;
}

function formatCurrency(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return value;
  
  const rounded = Math.round(num);
  const formatted = rounded.toLocaleString('pt-BR');
  return `R$ ${formatted}`;
}

function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

const categoryConfig: Record<string, { icon: typeof Store; color: string; bgColor: string; order: number }> = {
  "Atributos Pago": { icon: CreditCard, color: "text-green-600", bgColor: "bg-green-50 border-green-200", order: 1 },
  "Financeiro": { icon: Wallet, color: "text-green-600", bgColor: "bg-green-50 border-green-200", order: 1 },
  "Informações cadastrais": { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", order: 2 },
  "Dados Cadastrais": { icon: FileText, color: "text-blue-600", bgColor: "bg-blue-50 border-blue-200", order: 2 },
  "Localização": { icon: MapPin, color: "text-purple-600", bgColor: "bg-purple-50 border-purple-200", order: 3 },
  "Atributos Marketplace": { icon: Store, color: "text-orange-600", bgColor: "bg-orange-50 border-orange-200", order: 4 },
  "Outros": { icon: Package, color: "text-gray-600", bgColor: "bg-gray-50 border-gray-200", order: 99 },
};

const iconMap: Record<string, typeof Store> = {
  "credit-card": CreditCard,
  "store": Store,
  "banknote": Banknote,
  "wallet": Wallet,
  "shopping-bag": ShoppingBag,
  "package": Package,
};

function getIconComponent(iconName?: string) {
  if (!iconName) return null;
  return iconMap[iconName] || null;
}

function getCategoryConfig(category: string) {
  return categoryConfig[category] || categoryConfig["Outros"];
}

export function ClientProfileCard({ data }: ClientProfileCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const hasData = data && data.campos && Object.keys(data.campos).length > 0;

  const groupedByCategory = new Map<string, Map<string, ProductGroup>>();
  
  if (hasData && data.campos) {
    Object.entries(data.campos).forEach(([key, field]) => {
      const category = field.category || "Outros";
      const productName = field.product?.name || "_no_product_";
      const subproductName = field.subproduct?.name || "";
      const groupKey = `${productName}::${subproductName}`;
      
      if (!groupedByCategory.has(category)) {
        groupedByCategory.set(category, new Map());
      }
      
      const categoryMap = groupedByCategory.get(category)!;
      
      if (!categoryMap.has(groupKey)) {
        categoryMap.set(groupKey, {
          product: field.product || null,
          subproduct: field.subproduct,
          fields: [],
        });
      }
      
      categoryMap.get(groupKey)!.fields.push({
        key,
        label: field.label,
        value: field.value,
        dataType: field.dataType,
        product: field.product,
        subproduct: field.subproduct,
      });
    });
  }

  const sortedCategories = Array.from(groupedByCategory.keys()).sort((a, b) => {
    return getCategoryConfig(a).order - getCategoryConfig(b).order;
  });

  const fieldCount = hasData ? Object.keys(data.campos!).length : 0;

  return (
    <div className="rounded-lg p-3 bg-indigo-50 border border-indigo-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 text-indigo-600" />
        ) : (
          <ChevronRight className="w-4 h-4 text-indigo-600" />
        )}
        <div className="text-indigo-600">
          <Building2 className="w-4 h-4" />
        </div>
        <h4 className="font-medium text-gray-800 text-sm">Perfil do Cliente</h4>
        {hasData && (
          <span className="ml-auto text-xs text-indigo-600 font-medium">{fieldCount} campos</span>
        )}
        {!hasData && (
          <span className="ml-auto text-xs text-gray-400">Sem dados</span>
        )}
      </button>
      
      {isExpanded && (
        <>
          {!hasData ? (
            <div className="flex items-center gap-2 text-gray-400 py-2 mt-2">
              <User2 className="w-4 h-4" />
              <span className="text-sm">Dados do cliente não disponíveis</span>
            </div>
          ) : (
            <div className="space-y-3 mt-3">
              {data.cnpj && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-500">CNPJ:</span>
                  <span className="text-sm font-medium text-gray-700">{formatCNPJ(data.cnpj)}</span>
                  {data.cnpjValido !== undefined && (
                    <span className={`text-xs px-1.5 py-0.5 rounded ${data.cnpjValido ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {data.cnpjValido ? 'Válido' : 'Inválido'}
                    </span>
                  )}
                </div>
              )}
              
              {sortedCategories.map((category) => {
                const productsMap = groupedByCategory.get(category)!;
                const config = getCategoryConfig(category);
                const CategoryIcon = config.icon;
                const productEntries = Array.from(productsMap.entries());
                const hasProductInfo = productEntries.some(([key]) => !key.startsWith("_no_product_"));
                
                return (
                  <div key={category} className={`rounded-md p-2.5 border ${config.bgColor}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      <CategoryIcon className={`w-3.5 h-3.5 ${config.color}`} />
                      <span className={`text-xs font-semibold ${config.color}`}>{category}</span>
                    </div>
                    
                    <div className="space-y-2">
                      {productEntries.map(([productKey, productGroup]) => {
                        const ProductIcon = productGroup.product?.icon ? getIconComponent(productGroup.product.icon) : null;
                        const productColor = productGroup.product?.color;
                        const showProductHeader = hasProductInfo && productGroup.product;
                        
                        return (
                          <div key={productKey} className={showProductHeader ? "bg-white/50 rounded p-2" : ""}>
                            {showProductHeader && productGroup.product && (
                              <div className="flex items-center gap-1.5 mb-1.5">
                                {ProductIcon && (
                                  <ProductIcon 
                                    className="w-3 h-3" 
                                    style={productColor ? { color: productColor } : undefined}
                                  />
                                )}
                                <span 
                                  className="text-xs font-medium"
                                  style={productColor ? { color: productColor } : undefined}
                                >
                                  {productGroup.product.name}
                                  {productGroup.subproduct && (
                                    <span className="text-gray-400 font-normal"> / {productGroup.subproduct.name}</span>
                                  )}
                                </span>
                              </div>
                            )}
                            <div className="grid grid-cols-1 gap-1">
                              {productGroup.fields.map((field) => (
                                <div key={field.key} className="flex items-start gap-2">
                                  <span className="text-xs text-gray-500 flex-shrink-0">{field.label}:</span>
                                  <span className="text-sm font-medium text-gray-700">
                                    {field.dataType === 'number' ? formatCurrency(field.value) : (field.value || '-')}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
