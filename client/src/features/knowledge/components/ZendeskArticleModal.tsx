import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ExternalLink, Clock, FileText } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { BaseModal } from "../../../shared/components/ui/BaseModal";

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

  const icon = (
    <div className="p-2 rounded-full bg-blue-100">
      <FileText className="w-5 h-5 text-blue-600" />
    </div>
  );

  const title = (
    <div className="flex items-center gap-2">
      <span>Artigo do Zendesk</span>
      <span className="text-sm text-gray-500 font-mono font-normal">#{zendeskId}</span>
      {article?.htmlUrl && (
        <a
          href={article.htmlUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Abrir no Zendesk externo"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );

  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      icon={icon}
      maxWidth="4xl"
    >
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
    </BaseModal>
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
