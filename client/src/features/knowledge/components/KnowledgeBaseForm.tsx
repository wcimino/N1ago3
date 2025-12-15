import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X, Tag, MessageSquare, CheckCircle, Plus, Trash2 } from "lucide-react";
import { ModernSelect, Button } from "@/shared/components/ui";
import type { KnowledgeSubject, KnowledgeIntent, ProductCatalogItem } from "../../../types";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "../hooks/useKnowledgeBase";

type CatalogProduct = ProductCatalogItem;

interface PrefilledArticleData {
  productId: number;
  subjectId: number;
  intentId: number;
  subjectName: string;
  intentName: string;
  productName: string;
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
    question: "",
    answer: "",
    keywords: "",
    questionVariation: [] as string[],
    productId: null as number | null,
    subjectId: null as number | null,
    intentId: null as number | null,
  });
  const [newVariation, setNewVariation] = useState("");
  const [initializedForId, setInitializedForId] = useState<number | null>(null);

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

  const dataReady = catalogLoaded && subjectsLoaded && intentsLoaded;

  const uniqueProducts = useMemo(() => {
    const seen = new Set<string>();
    return catalogProducts.filter(p => {
      if (seen.has(p.produto)) return false;
      seen.add(p.produto);
      return true;
    });
  }, [catalogProducts]);

  const filteredSubjects = useMemo(() => {
    if (!formData.productId) return [];
    const product = catalogProducts.find(p => p.id === formData.productId);
    if (!product) return [];
    const productCatalogIds = catalogProducts
      .filter(p => p.produto === product.produto)
      .map(p => p.id);
    return allSubjects.filter(s => productCatalogIds.includes(s.productCatalogId));
  }, [formData.productId, catalogProducts, allSubjects]);
  
  const filteredIntents = useMemo(() => {
    if (!formData.subjectId) return [];
    return allIntents.filter(i => i.subjectId === formData.subjectId);
  }, [formData.subjectId, allIntents]);

  const isInitialized = initialData ? initializedForId === initialData.id : initializedForId === 0;

  useEffect(() => {
    if (initialData && dataReady && initializedForId !== initialData.id) {
      setFormData({
        question: initialData.question || "",
        answer: initialData.answer || "",
        keywords: initialData.keywords || "",
        questionVariation: initialData.questionVariation || [],
        productId: initialData.productId,
        subjectId: initialData.subjectId,
        intentId: initialData.intentId,
      });
      setInitializedForId(initialData.id);
    } else if (prefilledData && !initialData && initializedForId !== -1) {
      setFormData({
        question: "",
        answer: "",
        keywords: "",
        questionVariation: [],
        productId: prefilledData.productId,
        subjectId: prefilledData.subjectId,
        intentId: prefilledData.intentId,
      });
      setInitializedForId(-1);
    } else if (!initialData && !prefilledData && initializedForId !== 0) {
      setFormData({
        question: "",
        answer: "",
        keywords: "",
        questionVariation: [],
        productId: null,
        subjectId: null,
        intentId: null,
      });
      setInitializedForId(0);
    }
  }, [initialData, prefilledData, dataReady, initializedForId]);

  const handleSelectChange = (name: string) => (value: string) => {
    if (name === "productId") {
      const numValue = value ? parseInt(value, 10) : null;
      setFormData((prev) => ({
        ...prev,
        productId: numValue,
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
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddVariation = () => {
    if (newVariation.trim()) {
      setFormData((prev) => ({
        ...prev,
        questionVariation: [...prev.questionVariation, newVariation.trim()],
      }));
      setNewVariation("");
    }
  };

  const handleRemoveVariation = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      questionVariation: prev.questionVariation.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      question: formData.question,
      answer: formData.answer,
      keywords: formData.keywords || null,
      questionVariation: formData.questionVariation.length > 0 ? formData.questionVariation : null,
      productId: prefilledData?.productId || formData.productId,
      subjectId: prefilledData?.subjectId || formData.subjectId,
      intentId: prefilledData?.intentId || formData.intentId,
    });
  };

  const isValid = (formData.question || "").trim() && (formData.answer || "").trim();

  const getProductName = () => {
    if (prefilledData) return prefilledData.productName;
    if (initialData?.productId) {
      const product = catalogProducts.find(p => p.id === initialData.productId);
      return product?.produto || "";
    }
    return "";
  };

  if (initialData && !isInitialized) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
          <Tag className="w-3.5 h-3.5" />
          Classificação
        </label>
        {prefilledData || initialData ? (
          <div className="flex items-center gap-1.5 flex-wrap py-1.5">
            <span className="px-2 py-1 text-xs bg-gray-100 rounded border border-gray-200 text-gray-700 font-medium">
              {getProductName()}
            </span>
            {(prefilledData?.subjectName || (initialData?.subjectId && allSubjects.find(s => s.id === initialData.subjectId)?.name)) && (
              <>
                <span className="text-gray-300">/</span>
                <span className="px-2 py-1 text-xs bg-blue-50 rounded border border-blue-200 text-blue-700 font-medium">
                  {prefilledData?.subjectName || allSubjects.find(s => s.id === initialData?.subjectId)?.name}
                </span>
              </>
            )}
            {(prefilledData?.intentName || (initialData?.intentId && allIntents.find(i => i.id === initialData.intentId)?.name)) && (
              <>
                <span className="text-gray-300">/</span>
                <span className="px-2 py-1 text-xs bg-green-50 rounded border border-green-200 text-green-700 font-medium">
                  {prefilledData?.intentName || allIntents.find(i => i.id === initialData?.intentId)?.name}
                </span>
              </>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <ModernSelect
              value={formData.productId?.toString() || ""}
              onValueChange={handleSelectChange("productId")}
              options={uniqueProducts.map((p) => ({ value: p.id.toString(), label: p.produto }))}
              placeholder="Produto *"
            />
            <ModernSelect
              value={formData.subjectId?.toString() || ""}
              onValueChange={handleSelectChange("subjectId")}
              options={filteredSubjects.map((s) => ({ value: s.id.toString(), label: s.name }))}
              placeholder="Assunto"
              disabled={!formData.productId || filteredSubjects.length === 0}
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

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            Pergunta
            <span className="text-red-400">*</span>
          </label>
          <textarea
            name="question"
            value={formData.question}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none transition-colors bg-white"
            placeholder="Qual é a pergunta ou dúvida do cliente?"
            required
          />
        </div>

        <div>
          <label className="flex items-center gap-1.5 text-xs font-medium text-green-700 mb-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            Resposta
            <span className="text-red-400">*</span>
          </label>
          <textarea
            name="answer"
            value={formData.answer}
            onChange={handleChange}
            rows={4}
            className="w-full px-3 py-2 text-sm border border-green-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 resize-none transition-colors bg-green-50"
            placeholder="Qual é a resposta para esta pergunta?"
            required
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
          <Tag className="w-3.5 h-3.5" />
          Palavras-chave
        </label>
        <input
          type="text"
          name="keywords"
          value={formData.keywords}
          onChange={handleChange}
          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
          placeholder="Ex: cartão, limite, fatura (separadas por vírgula)"
        />
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Variações da Pergunta
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newVariation}
            onChange={(e) => setNewVariation(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddVariation();
              }
            }}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
            placeholder="Digite uma variação e pressione Enter ou clique em +"
          />
          <button
            type="button"
            onClick={handleAddVariation}
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {formData.questionVariation.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.questionVariation.map((variation, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 border border-blue-200 rounded-lg text-blue-700"
              >
                {variation}
                <button
                  type="button"
                  onClick={() => handleRemoveVariation(index)}
                  className="hover:text-red-500"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        <Button
          type="button"
          onClick={onCancel}
          variant="outline"
          size="sm"
          leftIcon={<X className="w-4 h-4" />}
        >
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={!isValid || isLoading}
          isLoading={isLoading}
          size="sm"
          leftIcon={<Save className="w-4 h-4" />}
        >
          Salvar Artigo
        </Button>
      </div>
    </form>
  );
}
