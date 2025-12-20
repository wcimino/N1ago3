import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute, Link } from "wouter";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { fetchApi, apiRequest } from "../../../lib/queryClient";
import { KnowledgeBaseForm } from "../components/KnowledgeBaseForm";
import type { KnowledgeBaseArticle, KnowledgeBaseFormData } from "../hooks/useKnowledgeBase";

export function KnowledgeBaseArticlePage() {
  const [, params] = useRoute("/knowledge-base/article/:id");
  const articleId = params?.id ? parseInt(params.id) : null;
  const queryClient = useQueryClient();

  const { data: article, isLoading, error } = useQuery<KnowledgeBaseArticle>({
    queryKey: ["knowledge-article", articleId],
    queryFn: () => fetchApi<KnowledgeBaseArticle>(`/api/knowledge/articles/${articleId}`),
    enabled: articleId !== null,
  });

  const updateMutation = useMutation({
    mutationFn: (data: KnowledgeBaseFormData) =>
      apiRequest("PUT", `/api/knowledge/articles/${articleId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["knowledge-article", articleId] });
      queryClient.invalidateQueries({ queryKey: ["knowledge-articles"] });
    },
  });

  const handleSubmit = (data: KnowledgeBaseFormData) => {
    updateMutation.mutate(data);
  };

  if (!articleId) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>ID do artigo inválido</span>
        </div>
        <Link href="/knowledge-base" className="inline-flex items-center gap-2 mt-4 text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Base de Conhecimento
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center gap-2 text-red-600 mb-4">
          <AlertCircle className="w-5 h-5" />
          <span>Artigo não encontrado</span>
        </div>
        <Link href="/knowledge-base" className="inline-flex items-center gap-2 text-blue-600 hover:underline">
          <ArrowLeft className="w-4 h-4" />
          Voltar para Base de Conhecimento
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-4">
        <Link
          href="/knowledge-base"
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">
          Artigo #{articleId}
        </h2>
        {updateMutation.isSuccess && (
          <span className="ml-auto text-sm text-green-600">Salvo com sucesso!</span>
        )}
      </div>
      <div className="p-4">
        <KnowledgeBaseForm
          initialData={article}
          onSubmit={handleSubmit}
          onCancel={() => window.history.back()}
          isLoading={updateMutation.isPending}
        />
      </div>
    </div>
  );
}
