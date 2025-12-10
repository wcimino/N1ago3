import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { X, Loader2, ExternalLink, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ZendeskArticle {
  id: number;
  zendeskId: string;
  title: string;
  body: string | null;
  htmlUrl: string | null;
  sectionName: string | null;
  categoryName: string | null;
  zendeskUpdatedAt: string | null;
  locale: string | null;
}

interface ZendeskArticleModalProps {
  zendeskId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ZendeskArticleModal({ zendeskId, isOpen, onClose }: ZendeskArticleModalProps) {
  const { data: article, isLoading, error } = useQuery<ZendeskArticle>({
    queryKey: ["zendesk-article", zendeskId],
    queryFn: async () => {
      const res = await fetch(`/api/zendesk-articles/by-zendesk-id/${zendeskId}`, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Artigo não encontrado");
      }
      return res.json();
    },
    enabled: isOpen && !!zendeskId,
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={onClose}
      />
      <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            <span className="font-medium text-gray-900">Artigo do Zendesk</span>
            <span className="text-sm text-gray-500 font-mono">#{zendeskId}</span>
          </div>
          <div className="flex items-center gap-2">
            {article?.htmlUrl && (
              <a
                href={article.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                title="Abrir no Zendesk externo"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          )}

          {error && (
            <div className="text-center py-12 text-gray-500">
              <p>Artigo não encontrado na base local.</p>
              <p className="text-sm mt-2">O artigo pode não ter sido sincronizado ainda.</p>
            </div>
          )}

          {article && (
            <div className="space-y-4">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{article.title}</h2>
                {article.sectionName && (
                  <div className="flex items-center gap-1 mt-2 text-sm text-gray-500">
                    {article.categoryName && (
                      <>
                        <span className="text-purple-600">{article.categoryName}</span>
                        <span className="text-gray-300">›</span>
                      </>
                    )}
                    <span className="text-blue-600">{article.sectionName}</span>
                  </div>
                )}
                {article.zendeskUpdatedAt && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                    <Clock className="w-3 h-3" />
                    <span>
                      Atualizado há {formatDistanceToNow(new Date(article.zendeskUpdatedAt), { locale: ptBR })}
                    </span>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <div
                  className="prose prose-sm max-w-none text-gray-700"
                  dangerouslySetInnerHTML={{ __html: article.body || "<p>Sem conteúdo</p>" }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface UseZendeskArticleModalReturn {
  openArticle: (zendeskId: string) => void;
  modalProps: {
    zendeskId: string;
    isOpen: boolean;
    onClose: () => void;
  };
}

export function useZendeskArticleModal(): UseZendeskArticleModalReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [zendeskId, setZendeskId] = useState("");

  const openArticle = (id: string) => {
    setZendeskId(id);
    setIsOpen(true);
  };

  const onClose = () => {
    setIsOpen(false);
  };

  return {
    openArticle,
    modalProps: {
      zendeskId,
      isOpen,
      onClose,
    },
  };
}
