import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ExternalLink,
  ChevronDown,
  ChevronUp,
  FileText,
  Clock,
  BarChart3,
} from "lucide-react";
import { ZendeskArticle, SUBDOMAIN_LABELS, stripHtmlTags } from "../types/zendesk";

interface ZendeskArticleCardProps {
  article: ZendeskArticle;
  viewCount: number;
}

export function ZendeskArticleCard({ article, viewCount }: ZendeskArticleCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const plainText = stripHtmlTags(article.body);
  const preview = plainText.slice(0, 200) + (plainText.length > 200 ? "..." : "");
  
  return (
    <div className="bg-white border rounded-lg overflow-hidden hover:shadow-sm transition-shadow">
      <div
        className="px-4 py-3 cursor-pointer"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-start gap-3">
          <FileText className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-medium text-gray-900 truncate">{article.title}</h3>
              {article.helpCenterSubdomain && (
                <span className="px-1.5 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
                  {SUBDOMAIN_LABELS[article.helpCenterSubdomain] || article.helpCenterSubdomain}
                </span>
              )}
              {article.draft && (
                <span className="px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded">
                  Rascunho
                </span>
              )}
              {article.promoted && (
                <span className="px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded">
                  Promovido
                </span>
              )}
            </div>
            
            {article.sectionName && (
              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                {article.categoryName && (
                  <>
                    <span className="text-purple-600">{article.categoryName}</span>
                    <span className="text-gray-300">›</span>
                  </>
                )}
                <span className="text-blue-600">{article.sectionName}</span>
              </div>
            )}
            
            {!isExpanded && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-2">{preview}</p>
            )}
            
            <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
              {article.zendeskUpdatedAt && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Atualizado há {formatDistanceToNow(new Date(article.zendeskUpdatedAt), { locale: ptBR })}
                </span>
              )}
              {article.locale && (
                <span className="uppercase">{article.locale}</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              <BarChart3 className="w-3 h-3" />
              {viewCount}
            </span>
            {article.htmlUrl && (
              <a
                href={article.htmlUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                title="Abrir no Zendesk"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
            <button className="p-1.5 text-gray-400 hover:text-gray-600">
              {isExpanded ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t bg-gray-50">
          <div
            className="prose prose-sm max-w-none mt-3 text-gray-700"
            dangerouslySetInnerHTML={{ __html: article.body || "" }}
          />
        </div>
      )}
    </div>
  );
}
