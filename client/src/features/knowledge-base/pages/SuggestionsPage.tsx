import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKnowledgeSuggestions, type KnowledgeSuggestion } from "../hooks/useKnowledgeSuggestions";
import { Check, X, GitMerge, AlertTriangle, Clock, CheckCircle, XCircle, Plus, Pencil, Sparkles, Loader2, ChevronDown, FileText, ExternalLink, ArrowRight } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";

type StatusFilter = "pending" | "approved" | "rejected" | "merged" | "skipped" | "all";

interface KnowledgeArticle {
  id: number;
  name: string;
  description: string | null;
  resolution: string | null;
  observations: string | null;
}

type DiffPart = {
  type: 'equal' | 'removed' | 'added';
  value: string;
};

function computeInlineDiff(oldText: string, newText: string): DiffPart[] {
  const oldWords = oldText.split(/(\s+)/);
  const newWords = newText.split(/(\s+)/);
  
  const m = oldWords.length;
  const n = newWords.length;
  
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldWords[i - 1] === newWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }
  
  const result: DiffPart[] = [];
  let i = m, j = n;
  const temp: DiffPart[] = [];
  
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldWords[i - 1] === newWords[j - 1]) {
      temp.push({ type: 'equal', value: oldWords[i - 1] });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'added', value: newWords[j - 1] });
      j--;
    } else {
      temp.push({ type: 'removed', value: oldWords[i - 1] });
      i--;
    }
  }
  
  temp.reverse();
  
  let current: DiffPart | null = null;
  for (const part of temp) {
    if (current && current.type === part.type) {
      current.value += part.value;
    } else {
      if (current) result.push(current);
      current = { ...part };
    }
  }
  if (current) result.push(current);
  
  return result;
}

function DiffPreview({ 
  label, 
  before, 
  after 
}: { 
  label: string;
  before: string | null;
  after: string | null;
}) {
  const oldValue = before || "";
  const newValue = after || "";
  
  if (!before && !after) return null;
  
  const hasChange = before !== after;
  
  if (!hasChange) {
    return (
      <div className="space-y-2">
        <span className="text-xs font-medium text-gray-700">{label}:</span>
        <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200 text-gray-700">
          {before || <span className="text-gray-400 italic">Sem conteúdo</span>}
        </div>
      </div>
    );
  }
  
  const diffParts = computeInlineDiff(oldValue, newValue);
  
  return (
    <div className="space-y-2">
      <span className="text-xs font-medium text-gray-700">{label}:</span>
      <div className="text-sm p-3 rounded border bg-gray-50 border-gray-200 text-gray-700 leading-relaxed">
        {diffParts.map((part, idx) => {
          if (part.type === 'removed') {
            return (
              <span 
                key={idx} 
                className="bg-red-100 text-red-800 line-through px-0.5 rounded"
              >
                {part.value}
              </span>
            );
          }
          if (part.type === 'added') {
            return (
              <span 
                key={idx} 
                className="bg-green-100 text-green-800 px-0.5 rounded"
              >
                {part.value}
              </span>
            );
          }
          return <span key={idx}>{part.value}</span>;
        })}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    merged: "bg-blue-100 text-blue-800",
    skipped: "bg-gray-100 text-gray-800",
  };
  const icons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-3 h-3" />,
    approved: <CheckCircle className="w-3 h-3" />,
    rejected: <XCircle className="w-3 h-3" />,
    merged: <GitMerge className="w-3 h-3" />,
    skipped: <CheckCircle className="w-3 h-3" />,
  };
  const labels: Record<string, string> = {
    pending: "Pendente",
    approved: "Aprovado",
    rejected: "Rejeitado",
    merged: "Mesclado",
    skipped: "Sem melhoria",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${styles[status] || "bg-gray-100 text-gray-800"}`}>
      {icons[status]}
      {labels[status] || status}
    </span>
  );
}

function ConfidenceBadge({ score }: { score: number | null }) {
  if (score === null) return null;
  
  let color = "bg-red-100 text-red-800";
  if (score >= 80) color = "bg-green-100 text-green-800";
  else if (score >= 60) color = "bg-yellow-100 text-yellow-800";
  
  return (
    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${color}`}>
      {score}%
    </span>
  );
}

function SuggestionTypeBadge({ type, targetArticleId }: { type: string; targetArticleId: number | null }) {
  if (type === "update" && targetArticleId) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
        <Pencil className="w-3 h-3" />
        Atualizar #{targetArticleId}
      </span>
    );
  }
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
      <Plus className="w-3 h-3" />
      Criar novo
    </span>
  );
}

function QualityFlags({ flags }: { flags: KnowledgeSuggestion["qualityFlags"] }) {
  if (!flags) return null;
  
  const warnings = [];
  if (flags.isUncertain) warnings.push("Incerto");
  if (flags.possibleError) warnings.push("Possível erro");
  if (!flags.isComplete) warnings.push("Incompleto");
  if (flags.needsReview) warnings.push("Precisa revisão");
  
  if (warnings.length === 0) return null;
  
  return (
    <div className="flex items-center gap-1 text-amber-600">
      <AlertTriangle className="w-4 h-4" />
      <span className="text-xs">{warnings.join(", ")}</span>
    </div>
  );
}

function SourceArticlesBadge({ rawExtraction }: { rawExtraction: KnowledgeSuggestion["rawExtraction"] }) {
  if (!rawExtraction?.sourceArticles || rawExtraction.sourceArticles.length === 0) return null;
  
  const isEnrichment = rawExtraction.enrichmentSource === "zendesk";
  
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
      <div className="flex items-center gap-2">
        <FileText className="w-4 h-4 text-blue-600" />
        <span className="text-xs font-medium text-blue-800">
          {isEnrichment ? "Fontes do Zendesk" : "Artigos Relacionados"} ({rawExtraction.sourceArticles.length})
        </span>
      </div>
      <div className="space-y-1">
        {rawExtraction.sourceArticles.map((article, i) => (
          <div key={article.id || i} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1.5 border border-blue-100">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="text-blue-600 font-mono shrink-0">#{article.id}</span>
              <span className="text-gray-700 truncate">{article.title}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                article.similarityScore >= 80 ? "bg-green-100 text-green-700" :
                article.similarityScore >= 60 ? "bg-yellow-100 text-yellow-700" :
                "bg-gray-100 text-gray-600"
              }`}>
                {article.similarityScore}%
              </span>
              {isEnrichment && (
                <a
                  href={`https://ifoodbr.zendesk.com/hc/pt-br/articles/${article.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 hover:text-blue-700"
                  title="Abrir no Zendesk"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SuggestionCard({ 
  suggestion, 
  onApprove, 
  onReject,
  isApproving,
  isRejecting,
}: { 
  suggestion: KnowledgeSuggestion;
  onApprove: (id: number) => void;
  onReject: (params: { id: number; reason?: string }) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const [showRejectReason, setShowRejectReason] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  
  const isUpdate = suggestion.suggestionType === "update" && suggestion.similarArticleId;
  
  const { data: originalArticle, isLoading: isLoadingArticle } = useQuery<KnowledgeArticle>({
    queryKey: ["knowledge-article", suggestion.similarArticleId],
    queryFn: () => fetchApi<KnowledgeArticle>(`/api/knowledge/articles/${suggestion.similarArticleId}`),
    enabled: !!isUpdate,
  });

  const handleReject = () => {
    if (showRejectReason) {
      onReject({ id: suggestion.id, reason: rejectReason });
      setShowRejectReason(false);
      setRejectReason("");
    } else {
      setShowRejectReason(true);
    }
  };

  return (
    <div className="bg-white border rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <SuggestionTypeBadge type={suggestion.suggestionType} targetArticleId={suggestion.similarArticleId} />
          <StatusBadge status={suggestion.status} />
          <ConfidenceBadge score={suggestion.confidenceScore} />
        </div>
        <span className="text-xs text-gray-500">
          {new Date(suggestion.createdAt).toLocaleDateString("pt-BR")}
        </span>
      </div>
      
      {suggestion.suggestionType === "update" && suggestion.updateReason && (
        <div className="bg-orange-50 border border-orange-200 rounded-md p-2">
          <span className="text-xs font-medium text-orange-800">Motivo da atualização:</span>
          <p className="text-sm text-orange-700 mt-1">{suggestion.updateReason}</p>
        </div>
      )}

      <QualityFlags flags={suggestion.qualityFlags} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
        {suggestion.productStandard && (
          <div>
            <span className="text-gray-500">Produto:</span>
            <p className="font-medium">{suggestion.productStandard}</p>
          </div>
        )}
        <div>
          <span className="text-gray-500">Subproduto:</span>
          <p className={suggestion.subproductStandard ? "font-medium" : "text-gray-400 italic"}>
            {suggestion.subproductStandard || "(vazio)"}
          </p>
        </div>
        {suggestion.rawExtraction?.subjectName && (
          <div>
            <span className="text-gray-500">Assunto:</span>
            <p className="font-medium">{suggestion.rawExtraction.subjectName}</p>
          </div>
        )}
        {suggestion.rawExtraction?.intentName && (
          <div>
            <span className="text-gray-500">Intenção:</span>
            <p className="font-medium">{suggestion.rawExtraction.intentName}</p>
          </div>
        )}
      </div>

      {isUpdate ? (
        isLoadingArticle ? (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Carregando artigo original para comparação...</span>
            </div>
          </div>
        ) : originalArticle ? (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <ArrowRight className="w-4 h-4" />
              <span>Comparação: Artigo #{suggestion.similarArticleId} → Sugestão de melhoria</span>
            </div>
            
            <DiffPreview
              label="Situação"
              before={originalArticle.description}
              after={suggestion.description}
            />
            
            <DiffPreview
              label="Solução"
              before={originalArticle.resolution}
              after={suggestion.resolution}
            />
            
            <DiffPreview
              label="Observações"
              before={originalArticle.observations}
              after={suggestion.observations}
            />
          </div>
        ) : (
          <div className="space-y-4 border-t border-b py-3 my-2">
            <div className="flex items-center gap-2 text-xs text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              <span>Artigo original #{suggestion.similarArticleId} não encontrado</span>
            </div>
          </div>
        )
      ) : (
        <>
          {suggestion.description && (
            <div>
              <span className="text-xs text-gray-500">Situação:</span>
              <p className="text-sm mt-1">{suggestion.description}</p>
            </div>
          )}

          {suggestion.resolution && (
            <div>
              <span className="text-xs text-gray-500">Solução:</span>
              <p className="text-sm mt-1 bg-green-50 p-2 rounded">{suggestion.resolution}</p>
            </div>
          )}

          {suggestion.observations && (
            <div>
              <span className="text-xs text-gray-500">Observações:</span>
              <p className="text-sm mt-1 text-gray-600">{suggestion.observations}</p>
            </div>
          )}
        </>
      )}

      <SourceArticlesBadge rawExtraction={suggestion.rawExtraction} />

      {suggestion.status === "pending" && (
        <div className="pt-2 border-t">
          {showRejectReason ? (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Motivo da rejeição (opcional)"
                className="w-full px-3 py-2 border rounded-md text-sm"
                rows={2}
              />
              <div className="flex gap-2">
                <button
                  onClick={handleReject}
                  disabled={isRejecting}
                  className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
                >
                  <X className="w-4 h-4" />
                  Confirmar Rejeição
                </button>
                <button
                  onClick={() => setShowRejectReason(false)}
                  className="px-3 py-2 border rounded-md text-sm hover:bg-gray-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => onApprove(suggestion.id)}
                disabled={isApproving}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 disabled:opacity-50"
              >
                <Check className="w-4 h-4" />
                Aprovar
              </button>
              <button
                onClick={handleReject}
                disabled={isRejecting}
                className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700 disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Rejeitar
              </button>
            </div>
          )}
        </div>
      )}

      {suggestion.status === "rejected" && suggestion.rejectionReason && (
        <div className="pt-2 border-t">
          <span className="text-xs text-gray-500">Motivo da rejeição:</span>
          <p className="text-sm text-red-600 mt-1">{suggestion.rejectionReason}</p>
        </div>
      )}
    </div>
  );
}

function EnrichmentPanel() {
  const queryClient = useQueryClient();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedSubproduct, setSelectedSubproduct] = useState<string>("");
  const [limit, setLimit] = useState<number>(3);

  const { data: products = [] } = useQuery<string[]>({
    queryKey: ["product-catalog-distinct-produtos"],
    queryFn: () => fetchApi<string[]>("/api/product-catalog/distinct/produtos"),
  });

  const { data: subproducts = [] } = useQuery<string[]>({
    queryKey: ["product-catalog-distinct-subprodutos", selectedProduct],
    queryFn: () => fetchApi<string[]>(`/api/product-catalog/distinct/subprodutos?produto=${encodeURIComponent(selectedProduct)}`),
    enabled: !!selectedProduct,
  });

  interface EnrichmentResponse {
    success: boolean;
    intentsProcessed: number;
    articlesCreated: number;
    articlesUpdated: number;
    suggestionsGenerated: number;
    skipped: number;
    message?: string;
    errors?: string[];
  }

  const generateMutation = useMutation({
    mutationFn: async (params: { product?: string; subproduct?: string; limit: number }): Promise<EnrichmentResponse> => {
      const response = await apiRequest("POST", "/api/ai/enrichment/generate", params);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-suggestions"] });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({
      product: selectedProduct || undefined,
      subproduct: selectedSubproduct || undefined,
      limit,
    });
  };

  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-4 mb-4">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="flex-1 space-y-1">
          <h3 className="font-medium text-purple-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Gerar Sugestões de Melhoria
          </h3>
          <p className="text-sm text-purple-700">
            Analise artigos do Zendesk e gere sugestões de melhoria para a base de conhecimento
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
          <div className="relative">
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setSelectedSubproduct("");
              }}
              className="appearance-none bg-white border border-purple-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[160px]"
            >
              <option value="">Todos os produtos</option>
              {products.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
          </div>
          
          {selectedProduct && (
            <div className="relative">
              <select
                value={selectedSubproduct}
                onChange={(e) => setSelectedSubproduct(e.target.value)}
                className="appearance-none bg-white border border-purple-300 rounded-lg px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 min-w-[160px]"
              >
                <option value="">Todos subprodutos</option>
                {subproducts.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-purple-500 pointer-events-none" />
            </div>
          )}
          
          <div className="flex items-center gap-2">
            <label className="text-sm text-purple-700 whitespace-nowrap">Qtd. intenções:</label>
            <input
              type="number"
              min={1}
              max={50}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="w-16 bg-white border border-purple-300 rounded-lg px-2 py-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-medium hover:bg-purple-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                Gerar sugestões
              </>
            )}
          </button>
        </div>
      </div>
      
      {generateMutation.isError && (
        <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
          Erro ao gerar sugestões. Verifique se a configuração de enriquecimento está ativada nas configurações de IA.
        </div>
      )}
      
      {generateMutation.isSuccess && generateMutation.data && (
        <>
          {(generateMutation.data.articlesCreated > 0 || generateMutation.data.articlesUpdated > 0) ? (
            <div className="mt-3 text-sm text-green-600 bg-green-50 border border-green-200 rounded-md p-2">
              {generateMutation.data.articlesCreated > 0 && (
                <span>{generateMutation.data.articlesCreated} artigo(s) criado(s). </span>
              )}
              {generateMutation.data.articlesUpdated > 0 && (
                <span>{generateMutation.data.articlesUpdated} artigo(s) atualizado(s). </span>
              )}
              {generateMutation.data.skipped > 0 && (
                <span>{generateMutation.data.skipped} ignorado(s). </span>
              )}
              As novas sugestões aparecem na lista abaixo.
            </div>
          ) : generateMutation.data.intentsProcessed === 0 ? (
            <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
              {generateMutation.data.message || "Nenhuma intenção encontrada. Cadastre intenções primeiro na aba 'Assuntos e Intenções'."}
            </div>
          ) : generateMutation.data.skipped > 0 ? (
            <div className="mt-3 text-sm text-blue-600 bg-blue-50 border border-blue-200 rounded-md p-2">
              {generateMutation.data.skipped} intenção(ões) analisada(s), mas nenhuma sugestão gerada. 
              Os artigos já estão completos ou não há informação suficiente no Zendesk.
            </div>
          ) : (
            <div className="mt-3 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md p-2">
              {generateMutation.data.message || "Nenhuma sugestão gerada."}
            </div>
          )}
          
          {generateMutation.data.errors && generateMutation.data.errors.length > 0 && (
            <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-2">
              Erros: {generateMutation.data.errors.join(", ")}
            </div>
          )}
        </>
      )}
    </div>
  );
}

export function SuggestionsPage() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("pending");
  const { 
    suggestions, 
    stats, 
    isLoading, 
    approve, 
    reject, 
    isApproving, 
    isRejecting,
  } = useKnowledgeSuggestions(statusFilter === "all" ? undefined : statusFilter);

  return (
    <div className="space-y-4">
      <EnrichmentPanel />
      
      <div className="flex flex-wrap gap-2">
        {(["pending", "approved", "rejected", "merged", "skipped", "all"] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              statusFilter === status
                ? "bg-purple-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status === "pending" && `Pendentes${stats ? ` (${stats.pending})` : ""}`}
            {status === "approved" && `Aprovados${stats ? ` (${stats.approved})` : ""}`}
            {status === "rejected" && `Rejeitados${stats ? ` (${stats.rejected})` : ""}`}
            {status === "merged" && `Mesclados${stats ? ` (${stats.merged})` : ""}`}
            {status === "skipped" && "Sem melhoria"}
            {status === "all" && "Todos"}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-8 text-gray-500">Carregando sugestões...</div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          Nenhuma sugestão {statusFilter !== "all" ? `com status "${statusFilter}"` : "encontrada"}
        </div>
      ) : (
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <SuggestionCard
              key={suggestion.id}
              suggestion={suggestion}
              onApprove={approve}
              onReject={reject}
              isApproving={isApproving}
              isRejecting={isRejecting}
            />
          ))}
        </div>
      )}
    </div>
  );
}
