import { Link } from "wouter";
import { ExternalLink, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { KnowledgeBaseArticle } from "../hooks/useKnowledgeBase";

interface ArticleListItemProps {
  article: KnowledgeBaseArticle;
  depth: number;
  onEdit: (article: KnowledgeBaseArticle) => void;
  onDelete: (id: number) => void;
}

export function ArticleListItem({ article, depth, onDelete }: ArticleListItemProps) {
  const mobileIndent = depth * 12;
  const desktopIndent = depth * 20;
  
  return (
    <div 
      className="flex items-start gap-2 py-2 px-2 sm:px-3 rounded-lg hover:bg-gray-50 group"
      style={{ 
        marginLeft: `max(${mobileIndent}px, min(${desktopIndent}px, calc(${mobileIndent}px + (${desktopIndent - mobileIndent}px) * ((100vw - 320px) / 400))))` 
      }}
    >
      <div className="w-5 shrink-0" />

      <Link
        href={`/knowledge-base/article/${article.id}`}
        className="flex-1 min-w-0 hover:text-blue-600"
      >
        <span className="text-sm text-gray-900 break-words group-hover:text-blue-600">
          {article.question || (article.answer ? article.answer.substring(0, 60) : '')}
        </span>
        <span className="block sm:hidden text-xs text-gray-400 mt-0.5">
          {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
        </span>
      </Link>

      <span className="text-xs text-gray-400 whitespace-nowrap hidden sm:block shrink-0">
        {formatDistanceToNow(new Date(article.updatedAt), { addSuffix: true, locale: ptBR })}
      </span>

      <div className="flex items-center gap-1 shrink-0 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <Link
          href={`/knowledge-base/article/${article.id}`}
          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded"
          title="Abrir artigo"
        >
          <ExternalLink className="w-4 h-4" />
        </Link>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(article.id); }}
          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded"
          title="Excluir"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
