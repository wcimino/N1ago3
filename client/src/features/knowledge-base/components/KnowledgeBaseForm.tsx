import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Save, X, FileText, Tag, MessageSquare, CheckCircle, StickyNote, Sparkles, Loader2, Check, XCircle, ArrowRight } from "lucide-react";
import { ModernSelect } from "@/shared/components/ui";
import { DiffPreview } from "./DiffView";
import { SuggestionTypeBadge, StatusBadge, ConfidenceBadge } from "./SuggestionBadges";
import { SourceArticlesBadge } from "./SourceArticlesBadge";
import type { KnowledgeSubject, KnowledgeIntent, ProductCatalogItem } from "../../../types";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "../hooks/useKnowledgeBase";
import type { KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";

type CatalogProduct = ProductCatalogItem;

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
  const [isImproving, setIsImproving] = useState(false);
  const [improvementSuggestion, setImprovementSuggestion] = useState<KnowledgeSuggestion | null>(null);
  const [improvementError, setImprovementError] = useState<string | null>(null);
  const [improvementMessage, setImprovementMessage] = useState<string | null>(null);

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

  const handleSuggestImprovement = async () => {
    if (!initialData?.id) return;
    
    setIsImproving(true);
    setImprovementError(null);
    setImprovementMessage(null);
    setImprovementSuggestion(null);
    
    try {
      const response = await fetch("/api/ai/enrichment/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ articleId: initialData.id }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        setImprovementError(result.error || "Erro ao gerar sugestão");
        return;
      }
      
      if (!result.success) {
        setImprovementError(result.error || "Não foi possível gerar sugestão");
        return;
      }
      
      if (result.suggestionsGenerated === 0 || result.skipped > 0) {
        setImprovementMessage("A IA não encontrou melhorias para este artigo.");
        return;
      }
      
      if (result.suggestions && result.suggestions.length > 0) {
        const suggestionId = result.suggestions[0].id;
        const suggestionResponse = await fetch(`/api/knowledge/suggestions/${suggestionId}`, {
          credentials: "include",
        });
        
        if (suggestionResponse.ok) {
          const suggestionData: KnowledgeSuggestion = await suggestionResponse.json();
          setImprovementSuggestion(suggestionData);
        } else {
          setImprovementMessage("Sugestão criada! Acesse a aba Sugestões para revisar.");
        }
      } else {
        setImprovementMessage("A IA não encontrou melhorias para este artigo.");
      }
    } catch (error: any) {
      setImprovementError(error.message || "Erro ao gerar sugestão");
    } finally {
      setIsImproving(false);
    }
  };

  const handleApplySuggestion = () => {
    if (!improvementSuggestion) return;
    
    setFormData((prev) => ({
      ...prev,
      description: improvementSuggestion.description || prev.description,
      resolution: improvementSuggestion.resolution || prev.resolution,
      observations: improvementSuggestion.observations || prev.observations,
    }));
    setImprovementSuggestion(null);
    setImprovementMessage("Sugestão aplicada! Revise as alterações e salve o artigo.");
  };

  const handleDiscardSuggestion = () => {
    setImprovementSuggestion(null);
    setImprovementMessage(null);
    setImprovementError(null);
  };

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

      {improvementSuggestion && (
        <div className="bg-white border rounded-lg p-4 space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <SuggestionTypeBadge type={improvementSuggestion.suggestionType} targetArticleId={improvementSuggestion.similarArticleId} />
              <StatusBadge status={improvementSuggestion.status} />
              <ConfidenceBadge score={improvementSuggestion.confidenceScore} />
            </div>
            <span className="text-xs text-gray-500">
              {new Date(improvementSuggestion.createdAt).toLocaleDateString("pt-BR")}
            </span>
          </div>
          
          {improvementSuggestion.updateReason && (
            <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
              <span className="text-xs font-medium text-orange-800">Motivo da atualização:</span>
              <p className="text-sm text-orange-700 mt-1">{improvementSuggestion.updateReason}</p>
            </div>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {improvementSuggestion.productStandard && (
              <div>
                <span className="text-gray-500">Produto:</span>
                <p className="font-medium">{improvementSuggestion.productStandard}</p>
              </div>
            )}
            <div>
              <span className="text-gray-500">Subproduto:</span>
              <p className={improvementSuggestion.subproductStandard ? "font-medium" : "text-gray-400 italic"}>
                {improvementSuggestion.subproductStandard || "(vazio)"}
              </p>
            </div>
            {improvementSuggestion.rawExtraction?.subjectName && (
              <div>
                <span className="text-gray-500">Assunto:</span>
                <p className="font-medium">{improvementSuggestion.rawExtraction.subjectName}</p>
              </div>
            )}
            {improvementSuggestion.rawExtraction?.intentName && (
              <div>
                <span className="text-gray-500">Intenção:</span>
                <p className="font-medium">{improvementSuggestion.rawExtraction.intentName}</p>
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <ArrowRight className="w-4 h-4" />
              <span>Comparação: Artigo #{initialData?.id} → Sugestão de melhoria</span>
            </div>
            
            <DiffPreview
              label="Situação"
              before={formData.description}
              after={improvementSuggestion.description}
            />
            
            <DiffPreview
              label="Solução"
              before={formData.resolution}
              after={improvementSuggestion.resolution}
            />
            
            {(formData.observations || improvementSuggestion.observations) && (
              <DiffPreview
                label="Observações"
                before={formData.observations}
                after={improvementSuggestion.observations}
              />
            )}
          </div>

          <SourceArticlesBadge rawExtraction={improvementSuggestion.rawExtraction} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleApplySuggestion}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700"
            >
              <Check className="w-4 h-4" />
              Aprovar
            </button>
            <button
              type="button"
              onClick={handleDiscardSuggestion}
              className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
            >
              <X className="w-4 h-4" />
              Rejeitar
            </button>
          </div>
        </div>
      )}

      {improvementError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <XCircle className="w-4 h-4 shrink-0" />
          {improvementError}
        </div>
      )}

      {improvementMessage && !improvementSuggestion && (
        <div className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-700 text-sm">
          <Sparkles className="w-4 h-4 shrink-0" />
          {improvementMessage}
        </div>
      )}

      <div className="flex justify-end gap-2 pt-3 border-t border-gray-100">
        {initialData && (
          <button
            type="button"
            onClick={handleSuggestImprovement}
            disabled={isImproving || !initialData.intentId}
            title={!initialData.intentId ? "Associe uma intenção ao artigo para usar esta função" : ""}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isImproving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Sugerir Melhorias
              </>
            )}
          </button>
        )}
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
