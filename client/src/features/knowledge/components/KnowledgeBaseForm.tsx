import { useState, useEffect } from "react";
import { Tag, MessageSquare, CheckCircle, Plus, Trash2, X } from "lucide-react";
import { FormActions } from "@/shared/components/ui";
import { ProductHierarchySelects, ProductHierarchyDisplay } from "@/shared/components/forms/ProductHierarchySelects";
import { useProductHierarchySelects } from "@/shared/hooks";
import { InlineEnrichmentPanel } from "./InlineEnrichmentPanel";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "../hooks/useKnowledgeBase";

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
    keywords: [] as string[],
    questionVariation: [] as string[],
    questionNormalized: [] as string[],
    isActive: false,
  });
  const [newVariation, setNewVariation] = useState("");
  const [newNormalized, setNewNormalized] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [initializedForId, setInitializedForId] = useState<number | null>(null);

  const hierarchy = useProductHierarchySelects({
    initialValues: initialData 
      ? { productId: initialData.productId, subjectId: initialData.subjectId, intentId: initialData.intentId }
      : prefilledData
        ? { productId: prefilledData.productId, subjectId: prefilledData.subjectId, intentId: prefilledData.intentId }
        : undefined,
  });

  const isInitialized = initialData ? initializedForId === initialData.id : initializedForId === 0;

  useEffect(() => {
    if (initialData && hierarchy.isReady && initializedForId !== initialData.id) {
      let parsedNormalized: string[] = [];
      if (initialData.questionNormalized) {
        if (Array.isArray(initialData.questionNormalized)) {
          parsedNormalized = initialData.questionNormalized;
        } else if (typeof initialData.questionNormalized === 'string') {
          try {
            const parsed = JSON.parse(initialData.questionNormalized);
            if (Array.isArray(parsed)) parsedNormalized = parsed;
          } catch {
            parsedNormalized = initialData.questionNormalized.split(",").map(k => k.trim()).filter(k => k);
          }
        }
      }
      let parsedKeywords: string[] = [];
      if (initialData.keywords) {
        if (Array.isArray(initialData.keywords)) {
          parsedKeywords = initialData.keywords;
        } else if (typeof initialData.keywords === 'string') {
          try {
            const parsed = JSON.parse(initialData.keywords);
            if (Array.isArray(parsed)) parsedKeywords = parsed;
          } catch {
            parsedKeywords = initialData.keywords.split(",").map(k => k.trim()).filter(k => k);
          }
        }
      }
      setFormData({
        question: initialData.question || "",
        answer: initialData.answer || "",
        keywords: parsedKeywords,
        questionVariation: initialData.questionVariation || [],
        questionNormalized: parsedNormalized,
        isActive: initialData.isActive,
      });
      setInitializedForId(initialData.id);
    } else if (prefilledData && !initialData && initializedForId !== -1) {
      setFormData({
        question: "",
        answer: "",
        keywords: [],
        questionVariation: [],
        questionNormalized: [],
        isActive: false,
      });
      setInitializedForId(-1);
    } else if (!initialData && !prefilledData && initializedForId !== 0) {
      setFormData({
        question: "",
        answer: "",
        keywords: [],
        questionVariation: [],
        questionNormalized: [],
        isActive: false,
      });
      setInitializedForId(0);
    }
  }, [initialData, prefilledData, hierarchy.isReady, initializedForId]);

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

  const handleAddNormalized = () => {
    if (newNormalized.trim()) {
      setFormData((prev) => ({
        ...prev,
        questionNormalized: [...prev.questionNormalized, newNormalized.trim()],
      }));
      setNewNormalized("");
    }
  };

  const handleRemoveNormalized = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      questionNormalized: prev.questionNormalized.filter((_, i) => i !== index),
    }));
  };

  const handleAddKeyword = () => {
    const currentKeywords = Array.isArray(formData.keywords) ? formData.keywords : [];
    if (newKeyword.trim() && !currentKeywords.includes(newKeyword.trim())) {
      setFormData((prev) => ({
        ...prev,
        keywords: [...(Array.isArray(prev.keywords) ? prev.keywords : []), newKeyword.trim()],
      }));
      setNewKeyword("");
    }
  };

  const handleRemoveKeyword = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      keywords: (Array.isArray(prev.keywords) ? prev.keywords : []).filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const keywordsArray = Array.isArray(formData.keywords) ? formData.keywords : [];
    onSubmit({
      question: formData.question,
      answer: formData.answer,
      keywords: keywordsArray.length > 0 ? JSON.stringify(keywordsArray) : null,
      questionVariation: formData.questionVariation.length > 0 ? formData.questionVariation : null,
      questionNormalized: formData.questionNormalized.length > 0 ? JSON.stringify(formData.questionNormalized) : null,
      productId: prefilledData?.productId || hierarchy.selection.productId,
      subjectId: prefilledData?.subjectId || hierarchy.selection.subjectId,
      intentId: prefilledData?.intentId || hierarchy.selection.intentId,
      isActive: formData.isActive,
    });
  };

  const isValid = (formData.question || "").trim() && (formData.answer || "").trim();

  const getProductName = () => {
    if (prefilledData) return prefilledData.productName;
    if (initialData?.productId) {
      return hierarchy.getProductName(initialData.productId);
    }
    return "";
  };

  const getSubjectName = () => {
    if (prefilledData) return prefilledData.subjectName;
    if (initialData?.subjectId) {
      return hierarchy.getSubjectName(initialData.subjectId);
    }
    return "";
  };

  const getIntentName = () => {
    if (prefilledData) return prefilledData.intentName;
    if (initialData?.intentId) {
      return hierarchy.getIntentName(initialData.intentId);
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
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
            <Tag className="w-3.5 h-3.5" />
            Classificação
          </label>
          {prefilledData || initialData ? (
            <ProductHierarchyDisplay
              productName={getProductName()}
              subjectName={getSubjectName()}
              intentName={getIntentName()}
            />
          ) : (
            <ProductHierarchySelects
              productId={hierarchy.selection.productId}
              subjectId={hierarchy.selection.subjectId}
              intentId={hierarchy.selection.intentId}
              onProductChange={hierarchy.setProductId}
              onSubjectChange={hierarchy.setSubjectId}
              onIntentChange={hierarchy.setIntentId}
              products={hierarchy.products}
              subjects={hierarchy.subjects}
              intents={hierarchy.intents}
              showLabel={false}
              required
            />
          )}
        </div>
        <div className="flex items-center gap-2 pt-5">
          <span className={`text-sm font-medium ${formData.isActive ? 'text-green-700' : 'text-gray-500'}`}>
            {formData.isActive ? 'Ativo' : 'Inativo'}
          </span>
          <button
            type="button"
            onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
              formData.isActive ? 'bg-green-500' : 'bg-gray-300'
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                formData.isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
        <label className="flex items-center gap-1.5 text-xs font-medium text-purple-600 mb-1.5">
          <MessageSquare className="w-3.5 h-3.5" />
          Versões Normalizadas
          <span className="text-xs text-gray-400 font-normal ml-1">(para busca semântica)</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newNormalized}
            onChange={(e) => setNewNormalized(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddNormalized();
              }
            }}
            className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-colors bg-white"
            placeholder="Digite uma versão normalizada e pressione Enter ou clique em +"
          />
          <button
            type="button"
            onClick={handleAddNormalized}
            className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {formData.questionNormalized.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.questionNormalized.map((item, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 border border-purple-200 rounded-lg text-purple-700"
              >
                {item}
                <button
                  type="button"
                  onClick={() => handleRemoveNormalized(index)}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div>
        <label className="flex items-center gap-1.5 text-xs font-medium text-amber-600 mb-1.5">
          <Tag className="w-3.5 h-3.5" />
          Palavras-chave
          <span className="text-xs text-gray-400 font-normal ml-1">(para busca semântica)</span>
        </label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddKeyword();
              }
            }}
            className="flex-1 px-3 py-2 text-sm border border-amber-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors bg-white"
            placeholder="Digite uma palavra-chave e pressione Enter ou clique em +"
          />
          <button
            type="button"
            onClick={handleAddKeyword}
            className="px-3 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {Array.isArray(formData.keywords) && formData.keywords.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {formData.keywords.map((keyword, index) => (
              <span
                key={index}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-amber-50 border border-amber-200 rounded-lg text-amber-700"
              >
                {keyword}
                <button
                  type="button"
                  onClick={() => handleRemoveKeyword(index)}
                  className="hover:text-red-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
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

      <div className="pt-3 border-t border-gray-100 space-y-4">
        <InlineEnrichmentPanel
          intentId={hierarchy.selection.intentId}
          articleId={initialData?.id || null}
          currentData={{
            question: formData.question,
            answer: formData.answer,
            keywords: Array.isArray(formData.keywords) ? formData.keywords.join(", ") : "",
            questionVariation: formData.questionVariation,
          }}
          onApply={(suggestion) => {
            setFormData(prev => {
              const existingVariations = prev.questionVariation || [];
              const newVariations = (suggestion.questionVariation || []).filter(
                v => !existingVariations.includes(v)
              );
              const currentKeywords = Array.isArray(prev.keywords) ? prev.keywords : [];
              let newKeywords = currentKeywords;
              if (suggestion.keywords) {
                const suggestedKeywords = suggestion.keywords.split(",").map(k => k.trim()).filter(k => k);
                const uniqueNewKeywords = suggestedKeywords.filter(k => !currentKeywords.includes(k));
                newKeywords = [...currentKeywords, ...uniqueNewKeywords];
              }
              const existingNormalized = prev.questionNormalized || [];
              const newNormalized = (suggestion.questionNormalized || []).filter(
                n => !existingNormalized.includes(n)
              );
              return {
                ...prev,
                answer: suggestion.answer || prev.answer,
                keywords: newKeywords,
                questionVariation: [...existingVariations, ...newVariations],
                questionNormalized: [...existingNormalized, ...newNormalized],
              };
            });
          }}
        />

        <div className="flex justify-end">
          <FormActions
            isLoading={isLoading}
            isEditing={!!initialData}
            onCancel={onCancel}
            disabled={!isValid}
            submitLabel="Salvar Artigo"
          />
        </div>
      </div>
    </form>
  );
}
