import { useState, useEffect } from "react";
import { Tag, MessageSquare, CheckCircle, Search, Sparkles, Loader2 } from "lucide-react";
import { FormActions } from "@/shared/components/ui";
import { ProductHierarchySelects, ProductHierarchyDisplay, TagInput, CollapsibleSection } from "@/shared/components/forms";
import { useProductHierarchySelects } from "@/shared/hooks";
import { useInlineEnrichment } from "../hooks/useInlineEnrichment";
import { EnrichmentSuggestionPanel } from "./EnrichmentSuggestionPanel";
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

function parseArrayField(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      return value.split(",").map(k => k.trim()).filter(k => k);
    }
  }
  return [];
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
        keywords: parseArrayField(initialData.keywords),
        questionVariation: initialData.questionVariation || [],
        questionNormalized: parseArrayField(initialData.questionNormalized),
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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      question: formData.question,
      answer: formData.answer,
      keywords: formData.keywords.length > 0 ? JSON.stringify(formData.keywords) : null,
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
    if (initialData?.productId) return hierarchy.getProductName(initialData.productId);
    return "";
  };

  const getSubjectName = () => {
    if (prefilledData) return prefilledData.subjectName;
    if (initialData?.subjectId) return hierarchy.getSubjectName(initialData.subjectId);
    return "";
  };

  const getIntentName = () => {
    if (prefilledData) return prefilledData.intentName;
    if (initialData?.intentId) return hierarchy.getIntentName(initialData.intentId);
    return "";
  };

  const handleApplyEnrichment = (suggestion: {
    answer?: string;
    keywords?: string;
    questionVariation?: string[];
    questionNormalized?: string[];
  }) => {
    setFormData(prev => {
      const existingVariations = prev.questionVariation || [];
      const newVariations = (suggestion.questionVariation || []).filter(
        v => !existingVariations.includes(v)
      );
      
      const currentKeywords = prev.keywords;
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
  };

  if (initialData && !isInitialized) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const semanticTagsCount = formData.questionNormalized.length + formData.keywords.length;
  const variationsCount = formData.questionVariation.length;

  const enrichment = useInlineEnrichment({
    intentId: hierarchy.selection.intentId,
    articleId: initialData?.id || null,
    currentData: {
      question: formData.question,
      answer: formData.answer,
      keywords: formData.keywords.join(", "),
      questionVariation: formData.questionVariation,
    },
  });

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
        <div className="flex items-center gap-3 pt-5">
          <button
            type="button"
            onClick={enrichment.handleEnrich}
            disabled={enrichment.isLoading || !enrichment.isEnabled}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white rounded-lg text-xs font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title={!enrichment.isEnabled ? "Selecione uma intenção para habilitar" : "Enriquecer artigo com IA"}
          >
            {enrichment.isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                Enriquecer com IA
              </>
            )}
          </button>
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

      <CollapsibleSection
        title="Busca Semântica"
        icon={Search}
        badge={semanticTagsCount > 0 ? semanticTagsCount : undefined}
        colorScheme="purple"
        defaultExpanded={semanticTagsCount > 0}
      >
        <div className="space-y-4">
          <TagInput
            label="Versões Normalizadas"
            labelIcon={MessageSquare}
            labelHint="para busca semântica"
            placeholder="Digite uma versão normalizada e pressione Enter ou clique em +"
            values={formData.questionNormalized}
            onChange={(values) => setFormData(prev => ({ ...prev, questionNormalized: values }))}
            colorScheme="purple"
            maxVisible={6}
          />

          <TagInput
            label="Palavras-chave"
            labelIcon={Tag}
            labelHint="para busca semântica"
            placeholder="Digite uma palavra-chave e pressione Enter ou clique em +"
            values={formData.keywords}
            onChange={(values) => setFormData(prev => ({ ...prev, keywords: values }))}
            colorScheme="amber"
            maxVisible={8}
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        title="Variações da Pergunta"
        icon={MessageSquare}
        badge={variationsCount > 0 ? variationsCount : undefined}
        colorScheme="amber"
        defaultExpanded={false}
      >
        <TagInput
          label="Variações"
          labelIcon={MessageSquare}
          placeholder="Digite uma variação e pressione Enter ou clique em +"
          values={formData.questionVariation}
          onChange={(values) => setFormData(prev => ({ ...prev, questionVariation: values }))}
          colorScheme="orange"
          maxVisible={6}
        />
      </CollapsibleSection>

      <EnrichmentSuggestionPanel
        suggestion={enrichment.suggestion}
        skipReason={enrichment.skipReason}
        apiError={enrichment.apiError}
        isError={enrichment.isError}
        error={enrichment.error}
        expanded={enrichment.expanded}
        setExpanded={enrichment.setExpanded}
        currentData={{
          question: formData.question,
          answer: formData.answer,
          keywords: formData.keywords.join(", "),
          questionVariation: formData.questionVariation,
        }}
        onApply={handleApplyEnrichment}
        onDiscard={enrichment.handleDiscard}
      />

      <div className="pt-3 border-t border-gray-100 flex items-center justify-end">
        <FormActions
          isLoading={isLoading}
          isEditing={!!initialData}
          onCancel={onCancel}
          disabled={!isValid}
          submitLabel="Salvar Artigo"
        />
      </div>
    </form>
  );
}
