import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X, FileText, Tag, MessageSquare, CheckCircle, StickyNote } from "lucide-react";
import { ModernSelect } from "@/shared/components/ui";

interface KnowledgeBaseArticle {
  id: number;
  name: string | null;
  productStandard: string;
  subproductStandard: string | null;
  intent: string;
  description: string;
  resolution: string;
  observations: string | null;
  subjectId: number | null;
  intentId: number | null;
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
  subjectId: number | null;
  intentId: number | null;
}

interface KnowledgeSubject {
  id: number;
  productCatalogId: number;
  name: string;
  synonyms: string[];
  productName?: string | null;
}

interface KnowledgeIntent {
  id: number;
  subjectId: number;
  name: string;
  synonyms: string[];
  subjectName?: string | null;
}

interface CatalogProduct {
  id: number;
  produto: string;
  subproduto: string | null;
  fullName: string;
}

interface PrefilledArticleData {
  productStandard: string;
  subproductStandard: string | null;
  subjectId: number;
  intentId: number;
  subjectName: string;
  intentName: string;
}

interface KnowledgeBaseFormProps {
  initialData?: KnowledgeBaseArticle | null;
  prefilledData?: PrefilledArticleData | null;
  onSubmit: (data: KnowledgeBaseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function KnowledgeBaseForm({
  initialData,
  prefilledData,
  onSubmit,
  onCancel,
  isLoading = false,
}: KnowledgeBaseFormProps) {
  const [formData, setFormData] = useState({
    name: "",
    productStandard: "",
    intent: "",
    description: "",
    resolution: "",
    observations: "",
    subjectId: null as number | null,
    intentId: null as number | null,
  });
  const [initializedForId, setInitializedForId] = useState<number | null>(null);

  const { data: produtos = [], isSuccess: produtosLoaded } = useQuery<string[]>({
    queryKey: ["/api/product-catalog/distinct/produtos"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog/distinct/produtos");
      return res.json();
    },
  });

  const { data: catalogProducts = [], isSuccess: catalogLoaded } = useQuery<CatalogProduct[]>({
    queryKey: ["/api/product-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/product-catalog");
      return res.json();
    },
  });

  const { data: allSubjects = [], isSuccess: subjectsLoaded } = useQuery<KnowledgeSubject[]>({
    queryKey: ["/api/knowledge/subjects", { withProduct: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/subjects?withProduct=true");
      return res.json();
    },
  });

  const { data: allIntents = [], isSuccess: intentsLoaded } = useQuery<KnowledgeIntent[]>({
    queryKey: ["/api/knowledge/intents", { withSubject: true }],
    queryFn: async () => {
      const res = await fetch("/api/knowledge/intents?withSubject=true");
      return res.json();
    },
  });

  const dataReady = produtosLoaded && catalogLoaded && subjectsLoaded && intentsLoaded;

  const filteredSubjects = useMemo(() => {
    if (!formData.productStandard || catalogProducts.length === 0) return [];
    const productCatalogIds = catalogProducts
      .filter(p => p.produto === formData.productStandard)
      .map(p => p.id);
    return allSubjects.filter(s => productCatalogIds.includes(s.productCatalogId));
  }, [formData.productStandard, catalogProducts, allSubjects]);
  
  const filteredIntents = useMemo(() => {
    if (!formData.subjectId) return [];
    return allIntents.filter(i => i.subjectId === formData.subjectId);
  }, [formData.subjectId, allIntents]);

  const isInitialized = initialData ? initializedForId === initialData.id : initializedForId === 0;

  useEffect(() => {
    if (initialData && dataReady && initializedForId !== initialData.id) {
      setFormData({
        name: initialData.name || "",
        productStandard: initialData.productStandard,
        intent: initialData.intent || "",
        description: initialData.description,
        resolution: initialData.resolution,
        observations: initialData.observations || "",
        subjectId: initialData.subjectId,
        intentId: initialData.intentId,
      });
      setInitializedForId(initialData.id);
    } else if (prefilledData && !initialData && initializedForId !== -1) {
      setFormData({
        name: "",
        productStandard: prefilledData.productStandard,
        intent: prefilledData.intentName,
        description: "",
        resolution: "",
        observations: "",
        subjectId: prefilledData.subjectId,
        intentId: prefilledData.intentId,
      });
      setInitializedForId(-1);
    } else if (!initialData && !prefilledData && initializedForId !== 0) {
      setFormData({
        name: "",
        productStandard: "",
        intent: "",
        description: "",
        resolution: "",
        observations: "",
        subjectId: null,
        intentId: null,
      });
      setInitializedForId(0);
    }
  }, [initialData, prefilledData, dataReady, initializedForId]);

  const handleSelectChange = (name: string) => (value: string) => {
    if (name === "productStandard") {
      setFormData((prev) => ({
        ...prev,
        productStandard: value,
        subjectId: null,
        intentId: null,
      }));
    } else if (name === "subjectId") {
      const numValue = value ? parseInt(value, 10) : null;
      setFormData((prev) => ({
        ...prev,
        subjectId: numValue,
        intentId: null,
      }));
    } else if (name === "intentId") {
      const numValue = value ? parseInt(value, 10) : null;
      setFormData((prev) => ({ ...prev, intentId: numValue }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    let intentValue = formData.intent || "Outros";
    if (formData.intentId) {
      const selectedIntent = allIntents.find(i => i.id === formData.intentId);
      if (selectedIntent) {
        intentValue = selectedIntent.name;
      }
    }
    
    const productStandard = prefilledData?.productStandard || formData.productStandard;
    const subproductStandard = prefilledData?.subproductStandard || null;
    const subjectId = prefilledData?.subjectId || formData.subjectId;
    const intentId = prefilledData?.intentId || formData.intentId;
    
    onSubmit({
      name: formData.name || null,
      productStandard,
      subproductStandard,
      intent: intentValue,
      description: formData.description,
      resolution: formData.resolution,
      observations: formData.observations || null,
      subjectId,
      intentId,
    });
  };

  const isValid =
    (prefilledData?.productStandard || formData.productStandard.trim()) &&
    formData.description.trim() &&
    formData.resolution.trim();

  if (initialData && !isInitialized) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 sm:col-span-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <FileText className="w-3.5 h-3.5" />
            Nome do Artigo
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
            placeholder="Ex: Como contratar o Cartão de Crédito"
          />
        </div>

        <div className="col-span-2 sm:col-span-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <Tag className="w-3.5 h-3.5" />
            Classificação
          </label>
          {prefilledData ? (
            <div className="flex items-center gap-1.5 flex-wrap py-1.5">
              <span className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-200 text-gray-700 font-medium">
                {prefilledData.productStandard}
              </span>
              {prefilledData.subproductStandard && (
                <>
                  <span className="text-gray-300">/</span>
                  <span className="px-2 py-1 text-xs bg-purple-50 rounded border border-purple-200 text-purple-700 font-medium">
                    {prefilledData.subproductStandard}
                  </span>
                </>
              )}
              <span className="text-gray-300">/</span>
              <span className="px-2 py-1 text-xs bg-blue-50 rounded border border-blue-200 text-blue-700 font-medium">
                {prefilledData.subjectName}
              </span>
              <span className="text-gray-300">/</span>
              <span className="px-2 py-1 text-xs bg-green-50 rounded border border-green-200 text-green-700 font-medium">
                {prefilledData.intentName}
              </span>
            </div>
          ) : (
            <div className="flex gap-2">
              <ModernSelect
                value={formData.productStandard}
                onValueChange={handleSelectChange("productStandard")}
                options={produtos.map((p) => ({ value: p, label: p }))}
                placeholder="Produto *"
              />
              <ModernSelect
                value={formData.subjectId?.toString() || ""}
                onValueChange={handleSelectChange("subjectId")}
                options={filteredSubjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
                placeholder="Assunto"
                disabled={!formData.productStandard || filteredSubjects.length === 0}
              />
              <ModernSelect
                value={formData.intentId?.toString() || ""}
                onValueChange={handleSelectChange("intentId")}
                options={filteredIntents.map((i) => ({ value: i.id.toString(), label: i.name }))}
                placeholder="Intenção"
                disabled={!formData.subjectId || filteredIntents.length === 0}
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Problema
            <span className="text-red-400">*</span>
          </label>
          <textarea
            name="description"
            value={formData.description}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors bg-white"
            placeholder="Descreva a situação ou problema que o cliente pode apresentar..."
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Resolução
            <span className="text-red-400">*</span>
          </label>
          <textarea
            name="resolution"
            value={formData.resolution}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none transition-colors bg-green-50"
            placeholder="Descreva como resolver o problema..."
            required
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1.5">
          <StickyNote className="w-3.5 h-3.5" />
          Observações
          <span className="text-xs font-normal">(opcional)</span>
        </label>
        <textarea
          name="observations"
          value={formData.observations}
          onChange={handleChange}
          rows={2}
          className="w-full px-3 py-2 text-sm border border-gray-100 rounded-lg focus:ring-2 focus:ring-gray-300 focus:border-gray-300 resize-none transition-colors bg-gray-50"
          placeholder="Informações adicionais, links úteis, casos especiais..."
        />
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <X className="w-4 h-4" />
          Cancelar
        </button>
        <button
          type="submit"
          disabled={!isValid || isLoading}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-4 h-4" />
          {isLoading ? "Salvando..." : "Salvar Artigo"}
        </button>
      </div>
    </form>
  );
}
