import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X } from "lucide-react";
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

interface KnowledgeBaseFormProps {
  initialData?: KnowledgeBaseArticle | null;
  onSubmit: (data: KnowledgeBaseFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function KnowledgeBaseForm({
  initialData,
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
    } else if (!initialData && initializedForId !== 0) {
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
  }, [initialData, dataReady, initializedForId]);

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
    
    onSubmit({
      name: formData.name || null,
      productStandard: formData.productStandard,
      subproductStandard: null,
      intent: intentValue,
      description: formData.description,
      resolution: formData.resolution,
      observations: formData.observations || null,
      subjectId: formData.subjectId,
      intentId: formData.intentId,
    });
  };

  const isValid =
    formData.productStandard.trim() &&
    formData.description.trim() &&
    formData.resolution.trim();

  const inputClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors hover:border-gray-300";
  const textareaClass = "w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors hover:border-gray-300";
  const labelClass = "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide";

  if (initialData && !isInitialized) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelClass}>Nome do Artigo</label>
        <input
          type="text"
          name="name"
          value={formData.name}
          onChange={handleChange}
          className={inputClass}
          placeholder="Ex: Como contratar o Cartão de Crédito"
        />
      </div>

      <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className={labelClass}>Produto *</label>
            <ModernSelect
              value={formData.productStandard}
              onValueChange={handleSelectChange("productStandard")}
              options={produtos.map((p) => ({ value: p, label: p }))}
              placeholder="Selecione"
            />
          </div>
          <div>
            <label className={labelClass}>Assunto</label>
            <ModernSelect
              value={formData.subjectId?.toString() || ""}
              onValueChange={handleSelectChange("subjectId")}
              options={filteredSubjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
              placeholder={filteredSubjects.length === 0 ? "Nenhum assunto" : "Selecione"}
              disabled={!formData.productStandard || filteredSubjects.length === 0}
            />
          </div>
          <div>
            <label className={labelClass}>Intenção</label>
            <ModernSelect
              value={formData.intentId?.toString() || ""}
              onValueChange={handleSelectChange("intentId")}
              options={filteredIntents.map((i) => ({ value: i.id.toString(), label: i.name }))}
              placeholder={filteredIntents.length === 0 ? "Nenhuma intenção" : "Selecione"}
              disabled={!formData.subjectId || filteredIntents.length === 0}
            />
          </div>
        </div>
        {filteredSubjects.length === 0 && formData.productStandard && (
          <p className="text-xs text-amber-600 mt-2">
            Nenhum assunto cadastrado para este produto. Cadastre em Base de Conhecimento &gt; Assuntos e Intenções.
          </p>
        )}
      </div>

      <div>
        <label className={labelClass}>Descrição do Problema *</label>
        <textarea name="description" value={formData.description} onChange={handleChange} rows={2} className={textareaClass} placeholder="Descreva a situação ou problema..." required />
      </div>

      <div className="bg-green-50 rounded-xl p-4 border border-green-200">
        <label className={`${labelClass} text-green-700`}>Resolução *</label>
        <textarea name="resolution" value={formData.resolution} onChange={handleChange} rows={3} className={`${textareaClass} bg-white border-green-200 focus:ring-green-500 focus:border-green-500`} placeholder="Descreva a solução..." required />
      </div>

      <div>
        <label className={`${labelClass} text-gray-400`}>Observações</label>
        <textarea name="observations" value={formData.observations} onChange={handleChange} rows={2} className={`${textareaClass} bg-gray-50 border-gray-100`} placeholder="Opcional..." />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
          <X className="w-4 h-4" /> Cancelar
        </button>
        <button type="submit" disabled={!isValid || isLoading} className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm">
          <Save className="w-4 h-4" /> {isLoading ? "Salvando..." : "Salvar"}
        </button>
      </div>
    </form>
  );
}
