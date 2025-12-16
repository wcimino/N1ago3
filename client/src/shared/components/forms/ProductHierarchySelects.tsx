import { useMemo } from "react";
import { Tag } from "lucide-react";
import { ModernSelect } from "../ui";
import type { ProductCatalogItem, KnowledgeSubject, KnowledgeIntent } from "../../../types";

export interface ProductHierarchySelectsProps {
  productId: number | null;
  subjectId: number | null;
  intentId: number | null;
  onProductChange: (productId: number | null) => void;
  onSubjectChange: (subjectId: number | null) => void;
  onIntentChange: (intentId: number | null) => void;
  products: ProductCatalogItem[];
  subjects: KnowledgeSubject[];
  intents: KnowledgeIntent[];
  showSubject?: boolean;
  showIntent?: boolean;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  showLabel?: boolean;
  className?: string;
}

export function ProductHierarchySelects({
  productId,
  subjectId,
  intentId,
  onProductChange,
  onSubjectChange,
  onIntentChange,
  products,
  subjects,
  intents,
  showSubject = true,
  showIntent = true,
  disabled = false,
  required = false,
  label = "Classificação",
  showLabel = true,
  className = "",
}: ProductHierarchySelectsProps) {
  const uniqueProducts = useMemo(() => {
    const seen = new Set<number>();
    return products.filter(p => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [products]);

  const filteredSubjects = useMemo(() => {
    if (!productId) return [];
    return subjects.filter(s => s.productCatalogId === productId);
  }, [productId, subjects]);

  const filteredIntents = useMemo(() => {
    if (!subjectId) return [];
    return intents.filter(i => i.subjectId === subjectId);
  }, [subjectId, intents]);

  const handleProductChange = (value: string) => {
    const numValue = value ? parseInt(value, 10) : null;
    onProductChange(numValue);
    onSubjectChange(null);
    onIntentChange(null);
  };

  const handleSubjectChange = (value: string) => {
    const numValue = value ? parseInt(value, 10) : null;
    onSubjectChange(numValue);
    onIntentChange(null);
  };

  const handleIntentChange = (value: string) => {
    const numValue = value ? parseInt(value, 10) : null;
    onIntentChange(numValue);
  };

  return (
    <div className={className}>
      {showLabel && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
          <Tag className="w-3.5 h-3.5" />
          {label}
          {required && <span className="text-red-400">*</span>}
        </label>
      )}
      <div className="flex gap-2">
        <ModernSelect
          value={productId?.toString() || ""}
          onValueChange={handleProductChange}
          options={uniqueProducts.map((p) => ({ value: p.id.toString(), label: p.produto }))}
          placeholder={required ? "Produto *" : "Produto"}
          disabled={disabled}
        />
        {showSubject && (
          <ModernSelect
            value={subjectId?.toString() || ""}
            onValueChange={handleSubjectChange}
            options={filteredSubjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
            placeholder="Assunto"
            disabled={disabled || !productId || filteredSubjects.length === 0}
          />
        )}
        {showIntent && (
          <ModernSelect
            value={intentId?.toString() || ""}
            onValueChange={handleIntentChange}
            options={filteredIntents.map((i) => ({ value: i.id.toString(), label: i.name }))}
            placeholder="Intenção"
            disabled={disabled || !subjectId || filteredIntents.length === 0}
          />
        )}
      </div>
    </div>
  );
}

export interface ProductHierarchyDisplayProps {
  productName: string;
  subjectName?: string;
  intentName?: string;
  className?: string;
}

export function ProductHierarchyDisplay({
  productName,
  subjectName,
  intentName,
  className = "",
}: ProductHierarchyDisplayProps) {
  return (
    <div className={`flex items-center gap-1.5 flex-wrap py-1.5 ${className}`}>
      <span className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-200 text-gray-700 font-medium">
        {productName}
      </span>
      {subjectName && (
        <>
          <span className="text-gray-300">/</span>
          <span className="px-2 py-1 text-xs bg-blue-50 rounded border border-blue-200 text-blue-700 font-medium">
            {subjectName}
          </span>
        </>
      )}
      {intentName && (
        <>
          <span className="text-gray-300">/</span>
          <span className="px-2 py-1 text-xs bg-green-50 rounded border border-green-200 text-green-700 font-medium">
            {intentName}
          </span>
        </>
      )}
    </div>
  );
}
