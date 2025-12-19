import { useQuery } from "@tanstack/react-query";
import { Ban, FileText, Eye } from "lucide-react";
import { fetchApi } from "../../../lib/queryClient";
import type { EnrichmentLog } from "../../../types";
import { ZendeskArticleModal, useZendeskArticleModal } from "./ZendeskArticleModal";

function EnrichmentLogCard({ log }: { log: EnrichmentLog }) {
  const { openArticle, modalProps } = useZendeskArticleModal();

  return (
    <>
      <div className="bg-white border rounded-lg p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
              <Ban className="w-3 h-3" />
              Sem melhoria
            </span>
            {log.confidenceScore !== null && (
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                log.confidenceScore >= 80 ? "bg-green-100 text-green-800" :
                log.confidenceScore >= 60 ? "bg-yellow-100 text-yellow-800" :
                "bg-red-100 text-red-800"
              }`}>
                {log.confidenceScore}%
              </span>
            )}
          </div>
          <span className="text-xs text-gray-500">
            {new Date(log.processedAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit"
            })}
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
          <div>
            <span className="text-gray-500">Intenção ID:</span>
            <p className="font-medium">#{log.intentId}</p>
          </div>
          {log.productStandard && (
            <div>
              <span className="text-gray-500">Produto:</span>
              <p className="font-medium">{log.productStandard}</p>
            </div>
          )}
          {log.articleId && (
            <div>
              <span className="text-gray-500">Artigo:</span>
              <p className="font-medium">#{log.articleId}</p>
            </div>
          )}
          {log.triggerRunId && (
            <div>
              <span className="text-gray-500">Execução:</span>
              <p className="font-mono text-[10px] text-gray-600 truncate" title={log.triggerRunId}>
                {log.triggerRunId.slice(0, 8)}...
              </p>
            </div>
          )}
        </div>

        {log.outcomeReason && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-2">
            <span className="text-xs font-medium text-gray-700">Motivo:</span>
            <p className="text-sm text-gray-600 mt-1">{log.outcomeReason}</p>
          </div>
        )}

        {log.sourceArticles && log.sourceArticles.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 space-y-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-800">
                Fontes consultadas ({log.sourceArticles.length})
              </span>
            </div>
            <div className="space-y-1">
              {log.sourceArticles.map((article, i) => (
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
                    {article.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          openArticle(String(article.id));
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded p-0.5 transition-colors"
                        title="Ver artigo"
                        type="button"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <ZendeskArticleModal {...modalProps} />
    </>
  );
}

export function EnrichmentLogsList() {
  const { data: logs = [], isLoading, error } = useQuery<EnrichmentLog[]>({
    queryKey: ["article-enrichment-logs", "skip"],
    queryFn: () => fetchApi<EnrichmentLog[]>("/api/knowledge/article-enrichment-logs?action=skip&limit=100"),
    staleTime: 30000,
    refetchOnMount: true,
  });

  const { data: stats } = useQuery<{ total: number; created: number; updated: number; skipped: number }>({
    queryKey: ["article-enrichment-logs-stats"],
    queryFn: () => fetchApi("/api/knowledge/article-enrichment-logs/stats"),
    staleTime: 30000,
    refetchOnMount: true,
  });

  if (isLoading) {
    return <div className="text-center py-8 text-gray-500">Carregando logs...</div>;
  }

  if (error) {
    return (
      <div className="text-center py-8 text-red-500">
        Erro ao carregar logs: {error.message}
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nenhum processamento sem melhoria encontrado
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3">
          Total de processamentos: <span className="font-medium">{stats.total}</span> | 
          Criados: <span className="font-medium text-green-600">{stats.created}</span> | 
          Atualizados: <span className="font-medium text-orange-600">{stats.updated}</span> | 
          Sem melhoria: <span className="font-medium text-gray-600">{stats.skipped}</span>
        </div>
      )}
      {logs.map((log) => (
        <EnrichmentLogCard key={log.id} log={log} />
      ))}
    </div>
  );
}
