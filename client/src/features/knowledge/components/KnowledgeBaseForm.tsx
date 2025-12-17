import { useState, useEffect } from "react";
import { Tag, MessageSquare, CheckCircle, Plus, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
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
    keywords: "",
    questionVariation: [] as string[],
    isActive: false,
  });
  const [newVariation, setNewVariation] = useState("");
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
      setFormData({
        question: initialData.question || "",
        answer: initialData.answer || "",
        keywords: initialData.keywords || "",
        questionVariation: initialData.questionVariation || [],
        isActive: initialData.isActive,
      });
      setInitializedForId(initialData.id);
    } else if (prefilledData && !initialData && initializedForId !== -1) {
      setFormData({
        question: "",
        answer: "",
        keywords: "",
        questionVariation: [],
        isActive: false,
      });
      setInitializedForId(-1);
    } else if (!initialData && !prefilledData && initializedForId !== 0) {
      setFormData({
        question: "",
        answer: "",
        keywords: "",
        questionVariation: [],
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    onSubmit({
      question: formData.question,
      answer: formData.answer,
      keywords: formData.keywords || null,
      questionVariation: formData.questionVariation.length > 0 ? formData.questionVariation : null,
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
      <div>
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

      <InlineEnrichmentPanel
        intentId={hierarchy.selection.intentId}
        articleId={initialData?.id || null}
        currentData={{
          question: formData.question,
          answer: formData.answer,
          keywords: formData.keywords,
          questionVariation: formData.questionVariation,
        }}
        onApply={(suggestion) => {
          setFormData(prev => ({
            ...prev,
            question: suggestion.question || prev.question,
            answer: suggestion.answer || prev.answer,
            keywords: suggestion.keywords || prev.keywords,
            questionVariation: suggestion.questionVariation || prev.questionVariation,
          }));
        }}
      />

      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 rounded-lg border border-gray-200">
        <div className="flex items-center gap-2">
          {formData.isActive ? (
            <ToggleRight className="w-5 h-5 text-green-600" />
          ) : (
            <ToggleLeft className="w-5 h-5 text-gray-400" />
          )}
          <div>
            <span className={`text-sm font-medium ${formData.isActive ? 'text-green-700' : 'text-gray-600'}`}>
              {formData.isActive ? 'Ativo' : 'Inativo'}
            </span>
            <p className="text-xs text-gray-500">
              {formData.isActive 
                ? 'Este artigo será usado nas buscas do chatbot' 
                : 'Este artigo não será usado nas buscas do chatbot'}
            </p>
          </div>
        </div>
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

      <FormActions
        isLoading={isLoading}
        isEditing={!!initialData}
        onCancel={onCancel}
        disabled={!isValid}
        submitLabel="Salvar Artigo"
        className="pt-3 border-t border-gray-100"
      />
    </form>
  );
}
